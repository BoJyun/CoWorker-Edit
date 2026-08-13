const OnlineList = ({ isOnlineList, docUsers, hostEmail, currentUser }) => {
  if (!isOnlineList) return null;

  return (
    <div className="fixed bottom-24 right-8 z-30 w-64 rounded-xl border border-borderColor bg-white p-4 shadow-xl print:hidden">
      <h4 className="mb-3 text-sm font-semibold text-gray-500">
        線上協作者（{docUsers.length}）
      </h4>
      <ul className="flex max-h-60 flex-col gap-2 overflow-y-auto">
        {docUsers.map((u) => (
          <li key={u.userId} className="flex items-center gap-2">
            <img
              src={u.image}
              alt={u.username}
              className="h-7 w-7 rounded-full object-cover"
            />
            <span className="truncate text-sm">
              {u.username}
              {u.userEmail === currentUser && " (你)"}
            </span>
            {u.userEmail === hostEmail && (
              <span className="ml-auto text-xs text-primary">擁有者</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OnlineList;
