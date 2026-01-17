import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../css/Login.css";
import { API_BASE } from "./config";   // <<< ใช้แบบนี้
const Login = () => {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  // ✅ ดึง IP ของ server อัตโนมัติ ตาม hostname ที่ client เปิดอยู่
 
 
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post(`${API_BASE}/login`, {
        user,
        password,
      });

      if (res.data.success) {
        localStorage.setItem("loginUser", user);
        navigate("/group");
      } else {
        alert("Login Failed: กรุณาตรวจสอบ User / Password");
      }
    } catch (err) {
      console.error(err);
      alert("Server error: ไม่สามารถเชื่อมต่อ backend ได้");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">

        <h1 className="login-title">🏸 ก๊วนแบดมินตันน้ามาด</h1>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            className="login-input"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
            required
          />

          <button type="submit" className="login-btn">
            เข้าสู่ระบบ
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;
