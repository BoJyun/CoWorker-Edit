import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../redux/auth/authSlice";

const Nav = () => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate("/");
  };

  return (
    <nav className="flex items-center justify-between border-b border-borderColor bg-white px-6 py-3">
      <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary">
        <span>📝</span>
        <span>CoWorker Edit</span>
      </Link>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <Link
              to="/dashboard"
              title={user.name}
              className="max-w-[12rem] truncate text-sm font-medium text-gray-700 hover:text-primary"
            >
              {user.name || "我的帳號"}
            </Link>
            <img
              src={user.image}
              alt={user.name}
              className="h-8 w-8 rounded-full object-cover"
            />
            <button
              onClick={handleLogout}
              className="rounded-md border border-borderColor px-3 py-1.5 text-sm hover:bg-surface"
            >
              登出
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="text-sm font-medium text-gray-700 hover:text-primary"
            >
              登入
            </Link>
            <Link
              to="/signup"
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primaryDark"
            >
              免費註冊
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Nav;
