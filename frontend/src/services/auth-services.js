import axios from "axios";

const API_URL = `${import.meta.env.VITE_API_URL}/auth`;

const signup = (name, email, password) => {
  return axios.post(`${API_URL}/signup`, { name, email, password });
};

const login = (email, password) => {
  return axios.post(`${API_URL}/login`, { email, password });
};

const AuthServices = { signup, login };

export default AuthServices;
