import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import DocServices from "../../services/doc-services";
import { errorMessage } from "../../services/api";

const Delete = ({ socket, isDelete, docTitle, documentId, onClose }) => {
  const navigate = useNavigate();

  if (!isDelete) return null;

  const confirmDelete = async () => {
    try {
      await DocServices.deleteDoc(documentId);
      socket?.emit("delete-doc", documentId);
      toast.success("文件已刪除");
      navigate("/dashboard");
    } catch (err) {
      toast.error(errorMessage(err, "刪除失敗"));
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 print:hidden">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
        <div className="text-4xl">🗑️</div>
        <h3 className="mt-3 text-lg font-semibold">
          確定要刪除「{docTitle || "Untitled Document"}」嗎？
        </h3>
        <p className="mt-1 text-sm text-gray-400">此動作無法復原。</p>

        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-borderColor px-4 py-2 text-sm hover:bg-surface"
          >
            取消
          </button>
          <button
            onClick={confirmDelete}
            className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
          >
            刪除
          </button>
        </div>
      </div>
    </div>
  );
};

export default Delete;
