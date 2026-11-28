const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit"
});

export function taskScheduleFilter(tasks, filter, now = new Date()) {
  const today = dateFormat.format(now);
  const upcoming = new Date(today + "T00:00:00Z");
  upcoming.setUTCDate(upcoming.getUTCDate() + 7);
  const horizon = upcoming.toISOString().slice(0, 10);
  return tasks.filter(task => {
    if (filter === "ALL") return true;
    if (!["OPEN", "OVERDUE", "UPCOMING"].includes(filter)) return task.status === filter;
    if (task.status === "DONE" || task.status === "CANCELLED") return false;
    if (filter === "OPEN") return true;
    const due = typeof task.dueDate === "string" ? task.dueDate.slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
    return filter === "OVERDUE" ? due < today : today <= due && due <= horizon;
  });
}
