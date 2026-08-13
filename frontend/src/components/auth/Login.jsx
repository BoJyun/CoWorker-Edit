import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { login, resetAuthStatus } from "../../redux/auth/authSlice";
import Loading from "../Loading";

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const { email, password } = formData;

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, isLoading, isError, isSuccess, message } = useSelector(
    (state) => state.auth
  );

  useEffect(() => {
    if (isError) toast.error(message || "登入失敗，請再試一次");
    if (isSuccess && user) navigate("/dashboard");
    dispatch(resetAuthStatus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isError, isSuccess]);

  const onChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    dispatch(login({ email, password }));
  };

  if (isLoading) return <Loading />;

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-borderColor bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold">登入 CoWorker Edit</h1>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={onChange}
              className="w-full rounded-md border border-borderColor px-3 py-2 focus:border-primary focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              密碼
            </label>
            <input
              type="password"
              name="password"
              required
              value={password}
              onChange={onChange}
              className="w-full rounded-md border border-borderColor px-3 py-2 focus:border-primary focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="mt-2 rounded-md bg-primary py-2 font-medium text-white hover:bg-primaryDark"
          >
            登入
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          還沒有帳號？{" "}
          <Link to="/signup" className="font-medium text-primary">
            立即註冊
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
