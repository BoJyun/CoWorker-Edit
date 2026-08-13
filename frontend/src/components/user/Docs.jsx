import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import DocServices from "../../services/doc-services";
import { errorMessage } from "../../services/api";
import DocCard from "./DocCard";
import Loading from "../Loading";

// type: "mydoc" | "shared" | "recentlyOpened"
const fetcherByType = {
  mydoc: DocServices.myDoc,
  shared: DocServices.shared,
  recentlyOpened: DocServices.recentlyOpened,
};

const emptyMessageByType = {
  mydoc: "你還沒有建立任何文件，點選右上角「+ 新建文件」開始吧！",
  shared: "目前還沒有人與你分享文件。",
  recentlyOpened: "還沒有最近開啟的文件。",
};

const Docs = ({ type }) => {
  const [docs, setDocs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetcherByType[type]()
      .then((res) => {
        if (isMounted) setDocs(res.data);
      })
      .catch((err) => {
        toast.error(errorMessage(err, "文件載入失敗"));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [type]);

  if (isLoading) return <Loading />;

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <div className="text-4xl">🗂️</div>
        <p className="mt-4 text-sm">{emptyMessageByType[type]}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {docs.map((doc) => (
        <DocCard key={doc._id} doc={doc} />
      ))}
    </div>
  );
};

export default Docs;
