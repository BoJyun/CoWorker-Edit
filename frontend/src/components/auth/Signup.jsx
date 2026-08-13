import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { signup, resetAuthStatus } from "../../redux/auth/authSlice";
import Loading from "../Loading";

const Signup = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const { name, email, password, confirmPassword } = formData;

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading, isError, isSuccess, message } = useSelector(
    (state) => state.auth
  );

  useEffect(() => {
    if (isError) toast.error(message || "註冊失敗，請再試一次");
    if (isSuccess) {
      toast.success("註冊成功，請登入！");
      navigate("/login");
    }
    dispatch(resetAuthStatus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError, isSuccess]);

  const onChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("兩次輸入的密碼不一致");
      return;
    }
    dispatch(signup({ name, email, password }));
  };

  if (isLoading) return <Loading />;

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-borderColor bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold">建立帳號</h1>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              姓名
            </label>
            <input
              type="text"
              name="name"
              required
              maxLength={50}
              value={name}
              onChange={onChange}
              className="w-full rounded-md border border-borderColor px-3 py-2 focus:border-primary focus:outline-none"
              placeholder="王小明"
            />
          </div>

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
              minLength={6}
              value={password}
              onChange={onChange}
              className="w-full rounded-md border border-borderColor px-3 py-2 focus:border-primary focus:outline-none"
              placeholder="至少 6 碼"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              確認密碼
            </label>
            <input
              type="password"
              name="confirmPassword"
              required
              value={confirmPassword}
              onChange={onChange}
              className="w-full rounded-md border border-borderColor px-3 py-2 focus:border-primary focus:outline-none"
              placeholder="再輸入一次密碼"
            />
          </div>

          <button
            type="submit"
            className="mt-2 rounded-md bg-primary py-2 font-medium text-white hover:bg-primaryDark"
          >
            註冊
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          已經有帳號了？{" "}
          <Link to="/login" className="font-medium text-primary">
            前往登入
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
