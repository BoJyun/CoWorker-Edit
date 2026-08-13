import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Docs from "./Docs";

const TABS = [
  { key: "recentlyOpened", label: "最近開啟" },
  { key: "mydoc", label: "我的文件" },
  { key: "shared", label: "與我分享" },
];

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("recentlyOpened");
  const navigate = useNavigate();

  const createNewDoc = () => {
    const newId = crypto.randomUUID();
    navigate(`/document/${newId}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">我的文件</h1>
        <button
          onClick={createNewDoc}
          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primaryDark"
        >
          ＋ 新建文件
        </button>
      </div>

      <div className="mb-6 flex gap-1 border-b border-borderColor">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? "border-b-2 border-primary text-primary"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Docs type={activeTab} />
    </div>
  );
};

export default Dashboard;
