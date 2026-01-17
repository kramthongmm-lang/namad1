import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../css/group.css";
import { API_BASE } from "./config";   // <<< ใช้แบบนี้

const Group = () => {
  const [groupName, setGroupName] = useState("");
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");

  const loginUser = localStorage.getItem("loginUser");
  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await axios.get(`${API_BASE}/groups`);
      if (res.data.success) {
        setGroups(res.data.groups);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName) return;

    try {
      const res = await axios.post(`${API_BASE}/groups`, { groupName });
      if (res.data.success) {
        alert("Group created successfully!");
        setGroupName("");
        fetchGroups();
      }
    } catch (err) {
      console.log(err);
    }
  };

  //  ไปหน้า Player พร้อมส่งข้อมูล
  const goToPlayer = () => {
    if (!selectedGroup) {
      alert("กรุณาเลือก Group ก่อน");
      return;
    }

    navigate("/player", {
      state: {
        username: loginUser,
        group: selectedGroup,
      },
    });
  };

  return (
    <div className="group-container">

      <div className="user-info">
        <strong>{loginUser}</strong>
      </div>

      <h1 className="title">ก๊วนแบดมินตันน้ามาด - Group Management</h1>

      <div className="form-container">

        <form onSubmit={handleCreateGroup} className="group-form">
          <input
            type="text"
            placeholder="Enter new group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <button type="submit">Create Group</button>
        </form>

        <div className="dropdown-container">
          <label>Select Group:</label>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="">-- Select --</option>
            {groups.map((g, i) => (
              <option key={i} value={g.Group_Name}>
                {g.Group_Name}
              </option>
            ))}
          </select>
        </div>

        {/*  ปุ่มไปหน้า Player */}
        <button className="go-player-btn" onClick={goToPlayer}>
          ไปหน้า Player
        </button>

      </div>
    </div>
  );
};

export default Group;
