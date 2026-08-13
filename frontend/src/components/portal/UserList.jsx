import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import DocServices from "../../services/doc-services";
import { errorMessage } from "../../services/api";

const UserList = ({ socket, documentId, isOpenList, onClose }) => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!isOpenList) return;
    DocServices.docUserList(documentId)
      .then((res) => setUsers(res.data))
      .catch((err) => toast.error(errorMessage(err, "讀取名單失敗")));
  }, [isOpenList, documentId]);

  const handleRemove = async (email) => {
    try {
      await DocServices.removeUser(email, documentId);
      socket?.emit("delete-user", email);
      setUsers((prev) => prev.filter((u) => u.email !== email));
      toast.success("已移除協作者");
    } catch (err) {
      toast.error(errorMessage(err, "移除失敗"));
    }
  };

  if (!isOpenList) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 print:hidden">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">協作者名單</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {users.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            尚未分享給任何人
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {users.map((u) => (
              <li
                key={u.email}
                className="flex items-center justify-between rounded-md border border-borderColor px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                <button
                  onClick={() => handleRemove(u.email)}
                  className="text-xs font-medium text-red-500 hover:underline"
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default UserList;
