import { useCallback, useEffect, useRef, useState } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import QuillCursors from "quill-cursors";
import { io } from "socket.io-client";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { debounce } from "lodash";
import DocServices from "../services/doc-services";
import { errorMessage } from "../services/api";
import Delete from "./portal/Delete";
import EndSession from "./portal/EndSession";
import UserList from "./portal/UserList";
import OnlineList from "./portal/OnlineList";
import { CSS_COLOR_NAMES, totalColors } from "../utils/CSS_COLORS";

Quill.register("modules/cursors", QuillCursors);

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["bold", "italic", "underline"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ align: [] }],
  ["image", "blockquote", "code-block"],
  ["clean"],
];

const Editor = () => {
  const colorIndex = Math.floor(Math.random() * totalColors);
  const { user } = useSelector((state) => state.auth);
  const { id: documentId } = useParams();
  const navigate = useNavigate();

  const [socket, setSocket] = useState(null);
  const [quill, setQuill] = useState(null);
  const [cursors, setCursors] = useState(null);
  const [cursorColor] = useState(CSS_COLOR_NAMES[colorIndex]);

  const [docTitle, setDocTitle] = useState("");
  const [docBackground, setDocBackground] = useState("");
  const [hostEmail, setHostEmail] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [isDelete, setIsDelete] = useState(false);
  const [isEndSession, setIsEndSession] = useState(false);
  const [isOpenList, setIsOpenList] = useState(false);
  const [isOnlineList, setIsOnlineList] = useState(false);
  const [docUsers, setDocUsers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const accessInputRef = useRef();
  // 我們自己主動關掉 socket（按離開、被移除權限）時，
  // 別讓 disconnect handler 誤判成連線中斷、蓋掉真正的原因
  const isLeavingRef = useRef(false);

  // ---- connect socket ----
  useEffect(() => {
    if (!user) {
      setIsAuthorized(false);
      setErrorMsg("請先登入才能編輯文件");
      return;
    }

    // 帶上 JWT，伺服器連線時就驗身分，不靠前端自報 email
    const s = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token: localStorage.getItem("token") },
    });
    // 這個 listener 要在 emit 之前掛，而且不能等 quill 就緒才掛，
    // 否則 document-ready 可能在掛上去之前就先到了。
    const onDocumentReady = () => setIsJoined(true);
    s.on("document-ready", onDocumentReady);

    setSocket(s);
    s.emit("get-document", documentId);

    return () => {
      s.off("document-ready", onDocumentReady);
      setIsJoined(false);
      s.disconnect();
    };
  }, [user, documentId]);

  // ---- 主動離開編輯 ----
  // 內容是 800ms debounce 才存的，直接斷線會吃掉最後打的那一段，所以先補送一次。
  // save-document 在後端是整份覆蓋，重複送無害；關鍵是要等 ack 回來才能斷線，
  // 否則剛排進佇列的封包會跟著連線一起被丟掉。
  const leaveEditing = useCallback(() => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;

    const goBack = () => {
      socket?.disconnect();
      navigate("/dashboard");
    };

    if (!socket?.connected || !quill) {
      goBack();
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      goBack();
    };
    // 後端沒回應也不能把人卡在頁面上走不掉
    const fallback = setTimeout(finish, 3000);
    socket.emit("save-document", quill.getContents(), finish);
  }, [socket, quill, navigate]);

  // ---- load document metadata / permission check ----
  useEffect(() => {
    if (!quill || !user) return;

    const loadDoc = async () => {
      try {
        const response = await DocServices.getOneOrCreate(documentId);
        const docInfo = response.data;
        setDocTitle(docInfo.title);
        setHostEmail(docInfo.host?.email);
        setDocBackground(docInfo.background);
        quill.setContents(docInfo.data);
        setIsAuthorized(true);
      } catch (err) {
        setIsAuthorized(false);
        setErrorMsg(errorMessage(err, "你沒有權限開啟這份文件"));
        quill.disable();
      }
    };

    loadDoc();
  }, [quill, user, documentId]);

  // ---- 內容載入完、而且真的加入房間了，才開放編輯 ----
  // 後端要跑好幾趟資料庫才會把 sid 記進房間，在那之前送出的編輯與標題
  // 都會被丟掉。只看 REST 回應就 enable，使用者的修改會無聲消失。
  useEffect(() => {
    if (quill && isAuthorized && isJoined) quill.enable();
  }, [quill, isAuthorized, isJoined]);

  // ---- presence + lifecycle events ----
  useEffect(() => {
    if (!socket || !quill) return;

    const onJustJoined = (username) => toast.success(`${username} 加入了文件`);
    const onJustLeft = (username, userId) => {
      toast.info(`${username} 離開了文件`);
      cursors?.removeCursor(userId);
    };
    const onAllUsers = (users) => setDocUsers(users);
    const onRemoveUser = (deleteEmail) => {
      if (user.email === deleteEmail) {
        setIsAuthorized(false);
        setErrorMsg("你的存取權限已被移除");
        quill.disable();
        // 這行 disconnect 會觸發 onDisconnect，訊息會被蓋成「與伺服器的連線中斷了」，
        // 使用者就看不到真正的原因，所以先標記成主動關閉。
        isLeavingRef.current = true;
        socket.disconnect();
      }
    };
    const onDisconnect = () => {
      if (isLeavingRef.current) return; // 自己按了離開，不是斷線
      setIsAuthorized(false);
      setErrorMsg("與伺服器的連線中斷了");
      quill.disable();
    };
    const onSendTitle = (title) => setDocTitle(title);
    const onSessionEnded = (hostName) => {
      toast.info(`${hostName} 結束了這次協作`);
      leaveEditing();
    };

    socket.on("just-joined", onJustJoined);
    socket.on("just-left", onJustLeft);
    socket.on("all-users", onAllUsers);
    socket.on("remove-user", onRemoveUser);
    socket.on("disconnect", onDisconnect);
    socket.on("send-title", onSendTitle);
    socket.on("session-ended", onSessionEnded);

    return () => {
      socket.off("just-joined", onJustJoined);
      socket.off("just-left", onJustLeft);
      socket.off("all-users", onAllUsers);
      socket.off("remove-user", onRemoveUser);
      socket.off("disconnect", onDisconnect);
      socket.off("send-title", onSendTitle);
      socket.off("session-ended", onSessionEnded);
    };
  }, [socket, quill, cursors, user, leaveEditing]);

  // ---- receive remote content changes ----
  useEffect(() => {
    if (!socket || !quill) return;

    const receiveHandler = (delta) => quill.updateContents(delta);
    socket.on("receive-changes", receiveHandler);
    return () => socket.off("receive-changes", receiveHandler);
  }, [socket, quill]);

  // ---- receive remote cursor changes ----
  useEffect(() => {
    if (!socket || !quill || !cursors) return;

    const cursorHandler = (range, id, name, color) => {
      cursors.createCursor(id, name, color);
      cursors.moveCursor(id, range);
    };
    socket.on("receive-cursor", cursorHandler);
    return () => socket.off("receive-cursor", cursorHandler);
  }, [socket, quill, cursors]);

  // ---- send local changes / cursor / debounced save ----
  useEffect(() => {
    if (!socket || !quill) return;

    const saveDebounce = debounce(() => {
      socket.emit("save-document", quill.getContents());
      setTimeout(() => setIsSaving(false), 600);
    }, 800);

    const changeHandler = (delta, oldDelta, source) => {
      if (source !== "user") return;
      setIsSaving(true);
      socket.emit("send-changes", delta);
      saveDebounce();
    };

    const selectionHandler = (range) => {
      if (!range) return;
      socket.emit("send-cursor", range, user.id, user.name, cursorColor);
    };

    quill.on("text-change", changeHandler);
    quill.on("selection-change", selectionHandler);

    return () => {
      quill.off("text-change", changeHandler);
      quill.off("selection-change", selectionHandler);
    };
  }, [socket, quill, user, cursorColor]);

  // ---- initialize quill instance ----
  const wrapperRef = useCallback((wrapper) => {
    if (!wrapper) return;
    wrapper.innerHTML = "";
    const editorEl = document.createElement("div");
    wrapper.append(editorEl);

    const q = new Quill(editorEl, {
      theme: "snow",
      modules: {
        toolbar: TOOLBAR_OPTIONS,
        cursors: { transformOnTextChange: true },
      },
    });
    q.disable();
    q.setText("Loading...");

    setQuill(q);
    setCursors(q.getModule("cursors"));
  }, []);

  const titleChange = (e) => setDocTitle(e.target.value);
  const submitTitle = () => {
    if (!socket) return;
    socket.emit("save-title", docTitle, (res) => {
      if (res?.ok) toast.success("標題已儲存");
      else toast.error(res?.error || "標題儲存失敗");
    });
  };

  const grantAccess = async (e) => {
    e.preventDefault();
    const email = accessInputRef.current.value;
    try {
      const { data } = await DocServices.grantAccess(email, documentId);
      toast.success(data);
      accessInputRef.current.value = "";
    } catch (err) {
      toast.error(errorMessage(err, "授權失敗"));
    }
  };

  const confirmEndSession = () => {
    if (!socket) return;
    socket.emit("end-session", (res) => {
      setIsEndSession(false);
      if (res?.ok) leaveEditing();
      else toast.error(res?.error || "結束協作失敗");
    });
  };

  const exportPDF = () => window.print();

  const NOT_AUTHORIZED_STYLE = { filter: "blur(8px)" };

  return (
    <>
      {isAuthorized === false && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black/80 text-white">
          <div className="text-5xl">⛔</div>
          <p className="text-xl font-medium">{errorMsg}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="rounded-md border-2 border-white px-6 py-2"
          >
            回到我的文件
          </button>
        </div>
      )}

      {user && user.email === hostEmail && (
        <>
          <Delete
            socket={socket}
            isDelete={isDelete}
            docTitle={docTitle}
            documentId={documentId}
            onClose={() => setIsDelete(false)}
          />
          <UserList
            socket={socket}
            documentId={documentId}
            isOpenList={isOpenList}
            onClose={() => setIsOpenList(false)}
          />
          <EndSession
            isOpen={isEndSession}
            docTitle={docTitle}
            onConfirm={confirmEndSession}
            onClose={() => setIsEndSession(false)}
          />
        </>
      )}

      {user && (
        <OnlineList
          isOnlineList={isOnlineList}
          docUsers={docUsers}
          hostEmail={hostEmail}
          currentUser={user.email}
        />
      )}

      {isAuthorized && (
        <>
          <button
            onClick={() => setIsOnlineList((v) => !v)}
            className="fixed bottom-8 right-8 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-xl print:hidden"
          >
            👥
          </button>
          <span className="fixed bottom-[4.6rem] right-6 z-30 text-sm font-medium">
            {docUsers.length}
          </span>
        </>
      )}

      <div style={isAuthorized ? {} : NOT_AUTHORIZED_STYLE}>
        <div className="sticky top-0 z-20 flex flex-row items-center justify-between bg-white px-4 py-2 shadow-sm print:hidden">
          <div className="flex items-center gap-3">
            <span className="text-xl">📝</span>
            <input
              title="修改標題"
              className="w-56 border-none bg-transparent p-2 text-lg focus:border-b focus:border-primary focus:outline-none"
              type="text"
              value={docTitle}
              onChange={titleChange}
              onBlur={submitTitle}
            />
            <button onClick={exportPDF} className="text-sm text-gray-500 hover:text-primary">
              匯出 PDF
            </button>
            <button
              onClick={leaveEditing}
              className="text-sm text-gray-500 hover:text-primary"
            >
              離開編輯
            </button>
            {isSaving && (
              <span className="text-xs text-gray-400">儲存中...</span>
            )}
          </div>

          {user && hostEmail === user.email && (
            <div className="flex items-center gap-3">
              <form className="flex items-center gap-2" onSubmit={grantAccess}>
                <input
                  ref={accessInputRef}
                  type="email"
                  required
                  placeholder="輸入協作者 email"
                  className="rounded-md border border-borderColor px-2 py-1 text-xs"
                />
                <button type="submit" className="text-lg">✅</button>
              </form>
              <button
                onClick={() => setIsEndSession(true)}
                className="rounded-md border border-borderColor px-3 py-1 text-xs hover:bg-surface"
              >
                結束協作
              </button>
              <button onClick={() => setIsOpenList(true)} className="text-lg">📋</button>
              <button onClick={() => setIsDelete(true)} className="text-lg">🗑</button>
            </div>
          )}
        </div>

        {/* 背景圖只當外圍襯底，內容放在白色紙張上，避免文字壓在圖上難讀 */}
        <div
          className="min-h-[calc(100vh-52px)] bg-cover bg-center bg-fixed bg-no-repeat px-4 py-8 print:bg-none print:p-0"
          style={{ backgroundImage: `url(${docBackground})` }}
        >
          <div
            className="mx-auto w-full max-w-[860px] overflow-hidden rounded-lg bg-white shadow-2xl print:max-w-none print:rounded-none print:shadow-none"
            ref={wrapperRef}
          />
        </div>
      </div>
    </>
  );
};

export default Editor;
