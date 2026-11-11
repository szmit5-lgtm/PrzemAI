"use strict";

/**
 * Sales-agent execution policy. Pure functions, safe to call before any browser
 * or messaging tool. An approved action is valid for exactly one task/target.
 */
const ACTIONS=Object.freeze({
  DISCOVER_LEADS:"AUTO",
  READ_PUBLIC_PAGE:"AUTO",
  QUALIFY_LEAD:"AUTO",
  DRAFT_OUTREACH:"AUTO",
  SUMMARIZE_RESULTS:"AUTO",
  OPEN_LOGIN_PAGE:"AUTO",
  LOGIN:"APPROVAL",
  CREATE_ACCOUNT:"APPROVAL",
  SUBMIT_FORM:"APPROVAL",
  SEND_EMAIL:"APPROVAL",
  SEND_MESSAGE:"APPROVAL",
  ACCEPT_TERMS:"APPROVAL",
  MAKE_COMMITMENT:"APPROVAL",
  PURCHASE:"APPROVAL",
  CHANGE_PRICE:"APPROVAL",
});
const MAX_STEPS=40;
const MAX_LEADS=100;
function assertString(value,label,max=500){
  if(typeof value!=="string"||!value.trim()||value.length>max)
    throw new Error("Invalid "+label);
  return value.trim();
}
function createSalesTask(input){
  const organizationId=assertString(input?.organizationId,"organizationId",128);
  const requestedBy=assertString(input?.requestedBy,"requestedBy",128);
  const objective=assertString(input?.objective,"objective",2000);
  const limit=input?.leadLimit===undefined?20:Number(input.leadLimit);
  if(!Number.isInteger(limit)||limit<1||limit>MAX_LEADS)
    throw new Error("Invalid leadLimit");
  return {organizationId,requestedBy,objective,leadLimit:limit,
    status:"QUEUED",steps:[],leads:[],approvals:[]};
}
function normalizedTarget(target){
  if(typeof target!=="string"||target.length>2048)throw new Error("Invalid target");
  const value=target.trim();
  if(!value)throw new Error("Invalid target");
  return value;
}
function evaluateAction(task,action,context={}){
  if(!task||!task.organizationId||!task.requestedBy)
    throw new Error("Invalid task");
  if(!Object.prototype.hasOwnProperty.call(ACTIONS,action))
    return {allowed:false,reason:"UNKNOWN_ACTION"};
  if(task.steps?.length>=MAX_STEPS)
    return {allowed:false,reason:"STEP_LIMIT"};
  if(task.status==="COMPLETED"||task.status==="CANCELLED")
    return {allowed:false,reason:"TASK_CLOSED"};
  if(ACTIONS[action]==="AUTO")
    return {allowed:true,reason:"AUTONOMOUS"};
  const target=normalizedTarget(context.target);
  const approved=Array.isArray(task.approvals)&&task.approvals.some(a=>
    a&&a.status==="APPROVED"&&a.organizationId===task.organizationId&&
    a.taskId===context.taskId&&a.action===action&&a.target===target&&
    a.approvedBy===task.requestedBy&&a.used!==true);
  return {allowed:approved,reason:approved?"APPROVED":"APPROVAL_REQUIRED"};
}
function nextSalesStep(task,step,context={}){
  const action=assertString(step?.action,"action",80);
  const decision=evaluateAction(task,action,context);
  if(!decision.allowed)
    return {task:{...task,status:decision.reason==="APPROVAL_REQUIRED"?"WAITING_APPROVAL":task.status},
      decision};
  // Planning does not execute an external action or consume an approval.
  return {task:{...task,status:"READY",steps:[...(task.steps||[]),
    {action,target:context.target||null,status:"PLANNED"}]},decision};
}
module.exports={ACTIONS,MAX_STEPS,MAX_LEADS,createSalesTask,evaluateAction,nextSalesStep};
