const EndSession = ({ isOpen, docTitle, onConfirm, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 print:hidden">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
        <div className="text-4xl">👋</div>
        <h3 className="mt-3 text-lg font-semibold">
          結束「{docTitle || "Untitled Document"}」的協作？
        </h3>
        <p className="mt-1 text-sm text-gray-400">
          目前在線上的協作者都會被請回自己的文件列表，大家的編輯內容會先存好。
          文件不會被刪除，之後還可以再開。
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-borderColor px-4 py-2 text-sm hover:bg-surface"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            結束協作
          </button>
        </div>
      </div>
    </div>
  );
};

export default EndSession;
