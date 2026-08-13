import api from "./api";

const recentlyOpened = () => api.get("/doc/recentlyOpened");

const myDoc = () => api.get("/doc/mydoc");

const shared = () => api.get("/doc/shared");

const docUserList = (docId) => api.get(`/doc/users/${docId}`);

const getOneOrCreate = (docId) => api.get(`/doc/${docId}`);

const grantAccess = (email, docId) =>
  api.patch("/doc/access", { email, docId });

const removeUser = (email, docId) => api.patch("/doc/remove", { email, docId });

const deleteDoc = (docId) => api.delete(`/doc/${docId}`);

const DocServices = {
  recentlyOpened,
  myDoc,
  shared,
  docUserList,
  getOneOrCreate,
  grantAccess,
  removeUser,
  deleteDoc,
};

export default DocServices;
