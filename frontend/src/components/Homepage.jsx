import { Link } from "react-router-dom";
import { useSelector } from "react-redux";

const features = [
  { icon: "⚡", title: "即時同步", desc: "多人同時編輯，變更即時同步給所有協作者。" },
  { icon: "🖱️", title: "即時游標", desc: "看到每個協作者當下的游標位置與名字。" },
  { icon: "🔐", title: "權限管理", desc: "只有文件擁有者能邀請或移除協作者。" },
  { icon: "📱", title: "跨裝置", desc: "手機、平板、桌機都能隨時繼續編輯。" },
];

const Homepage = () => {
  const { user } = useSelector((state) => state.auth);

  return (
    <div>
      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center">
        <h1 className="text-4xl font-bold leading-tight md:text-5xl">
          與團隊即時協作
          <br />
          <span className="text-primary">同一份文件，同一個當下</span>
        </h1>
        <p className="mt-6 max-w-xl text-gray-500">
          CoWorker Edit 是一個線上多人即時協作文件編輯器，隨時隨地與夥伴一起編輯、討論。
        </p>
        <Link
          to={user ? "/dashboard" : "/signup"}
          className="mt-8 rounded-md bg-primary px-8 py-3 font-medium text-white shadow-sm hover:bg-primaryDark"
        >
          {user ? "前往我的文件" : "免費開始使用"}
        </Link>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-6 pb-24 sm:grid-cols-2 md:grid-cols-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-borderColor bg-white p-6 text-left shadow-sm"
          >
            <div className="text-3xl">{f.icon}</div>
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
};

export default Homepage;
