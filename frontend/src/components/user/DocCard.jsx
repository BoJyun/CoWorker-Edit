import { useNavigate } from "react-router-dom";
import { DateTime } from "luxon";

const DocCard = ({ doc }) => {
  const navigate = useNavigate();
  const timestamp = doc.lastModified || doc.lastOpened;

  return (
    <div
      onClick={() => navigate(`/document/${doc._id}`)}
      className="cursor-pointer overflow-hidden rounded-xl border border-borderColor bg-white shadow-sm transition hover:shadow-md"
    >
      <div
        className="h-28 bg-cover bg-center"
        style={{ backgroundImage: `url(${doc.background})` }}
      />
      <div className="p-4">
        <h3 className="truncate font-semibold">
          {doc.title || "Untitled Document"}
        </h3>
        <p className="mt-1 truncate text-xs text-gray-400">
          擁有者：{doc.host?.name || "我"}
        </p>
        {timestamp && (
          <p className="mt-1 text-xs text-gray-400">
            {DateTime.fromISO(timestamp).toRelative()}
          </p>
        )}
      </div>
    </div>
  );
};

export default DocCard;
