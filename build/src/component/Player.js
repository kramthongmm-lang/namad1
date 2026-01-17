import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "../css/player.css";
import { API_BASE } from "./config";

const RANKS = ["BABY", "BG","BGM", "NB", "N","NP", "S", "P"];

const SmallBarChart = ({ data }) => {
  const max = Math.max(...data.map((d) => d.cnt), 1);

  return (
    <div className="chart">
      {data.map((d) => (
        <div key={d.rank} className="chart-row">
          <div className="chart-label">
            {d.rank} ({d.cnt})
          </div>
          <div className="chart-bar-wrap">
            <div
              className="chart-bar"
              style={{ width: `${(d.cnt / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const Player = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const username =
    location.state?.username || localStorage.getItem("loginUser");
  const group = location.state?.group || localStorage.getItem("selectedGroup");

  const [players, setPlayers] = useState([]);
  const [stats, setStats] = useState([]);
  const [totalPay, setTotalPay] = useState(0);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [order, setOrder] = useState("DESC");
  const [loading, setLoading] = useState(false);
const [courts, setCourts] = useState([]);
const [newCourt, setNewCourt] = useState(1);
const [editingCourtId, setEditingCourtId] = useState(null);
const [editCourt, setEditCourt] = useState("");
const [selectedCourts, setSelectedCourts] = useState([]);
const [showAddCourt, setShowAddCourt] = useState(false);

const fetchCourts = async () => {
  const res = await axios.get(`${API_BASE}/court/${group}`);
  if (res.data.success) setCourts(res.data.courts);
};

useEffect(() => {
  fetchCourts();
}, [group]);
const addCourt = async () => {
  try {
    const res = await axios.post(`${API_BASE}/court`, {
      cort: newCourt,
      group,
    });

    if (res.data.message === "duplicate") {
      alert("คอร์ทนี้มีอยู่แล้ว");
      return;
    }

    fetchCourts();
  } catch (err) {
    console.error(err);
  }
};
const toggleCourtStatus = async (c) => {
  const newStatus = c.Cort_Status === "Active" ? "Check" : "Active";

  await axios.put(`${API_BASE}/court/status/${c.id}`, {
    Cort_Status: newStatus,
  });

  fetchCourts();
};
const deleteCourt = async (id) => {
  if (!window.confirm("ลบคอร์ทนี้?")) return;
  await axios.delete(`${API_BASE}/court/${id}`);
  fetchCourts();
};
const toggleCourtSelect = (courtNo) => {
  setSelectedCourts((prev) =>
    prev.includes(courtNo)
      ? prev.filter((c) => c !== courtNo)
      : [...prev, courtNo]
  );
};
const addCourts = async () => {
  if (selectedCourts.length === 0) {
    alert("กรุณาเลือกคอร์ทอย่างน้อย 1 คอร์ท");
    return;
  }

  try {
    for (const cort of selectedCourts) {
      await axios.post(`${API_BASE}/court`, {
        cort,
        group,
      });
    }

    setSelectedCourts([]);
    fetchCourts();
  } catch (err) {
    console.error(err);
  }
};

  // ADD PLAYER
  const [newPlayer, setNewPlayer] = useState({
    Player_Name: "",
    Player_Ranking: "NB",
    Player_Payment: "0",
     Player_Gender: "ชาย", 
  });
const [gender, setGender] = useState("male");

  // INLINE EDIT
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    Player_Name: "",
    Player_Ranking: "NB",
    Player_Payment: "0",
      Player_Gender: "",  
  });

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, 5000);
    return () => clearInterval(timer);
  }, [group, search, sortBy, order]);

  const fetchAll = async () => {
    if (!group) return;
    setLoading(true);

    try {
      const query = new URLSearchParams({
        search,
        sortBy,
        order,
      }).toString();

      const res = await axios.get(`${API_BASE}/players/${group}?${query}`);
      if (res.data.success) setPlayers(res.data.players);

    const s = await axios.get(`${API_BASE}/player/stats/${group}`);
console.log("STATS FROM API:", s.data.stats);

if (s.data.success) {
  const map = {};

  s.data.stats.ranking.forEach((r) => {
    map[r.Player_Ranking] = Number(r.cnt);
  });

  setStats(
    RANKS.map((rk) => ({
      rank: rk,
      cnt: map[rk] || 0,
    }))
  );
}

      const t = await axios.get(`${API_BASE}/player/totalpayment/${group}`);
      if (t.data.success) setTotalPay(t.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ADD PLAYER
  const addPlayer = async () => {
  if (!newPlayer.Player_Name || !newPlayer.Player_Gender || !newPlayer.Player_Gender) {
    alert("กรุณากรอกข้อมูลให้ครบ");
    return;
  }

  try {
    const res = await axios.post(`${API_BASE}/player`, {
      group,
      playerName: newPlayer.Player_Name,
      ranking: newPlayer.Player_Ranking,
      payment: newPlayer.Player_Payment,
      gender: newPlayer.Player_Gender,   // <--- ส่งไป backend
      status: "Active",
    });

    if (res.data.message === "duplicate") {
      alert("ชื่อนี้มีอยู่แล้ว!");
      return;
    }

    if (res.data.success) {
      alert("เพิ่มผู้เล่นสำเร็จ!");
      setNewPlayer({
        Player_Name: "",
        Player_Ranking: "NB",
        Player_Payment: "0",
        Player_Gender: "ชาย",       // reset gender
      });
      fetchAll();
    }
  } catch (err) {
    console.error(err);
  }
};

  // EDIT
  const onEdit = (p) => {
    setEditingId(p.id);
    setEditForm({
      Player_Name: p.Player_Name,
      Player_Ranking: p.Player_Ranking,
      Player_Payment: p.Player_Payment,
    });
  };

  const saveEdit = async () => {
    try {
      await axios.put(`${API_BASE}/player/${editingId}`, editForm);
    setEditingId(null);
      fetchAll();
    } catch (err) {
      console.error(err);
      alert("Update error");
    }
  };

  const cancelEdit = () => setEditingId(null);

  // TOGGLE BYE
  const onBye = async (id, status) => {
    if (!window.confirm("สลับสถานะ Bye / Active ?")) return;
    try {
      await axios.put(`${API_BASE}/player/${id}`, {
        Player_Status: status,
      });
      fetchAll();
    } catch (err) {
      console.error(err);
    }
  };

  // DELETE
  const onDelete = async (id) => {
    if (!window.confirm("ลบผู้เล่นนี้?")) return;

    try {
      await axios.delete(`${API_BASE}/player/${id}`);
      fetchAll();
    } catch (err) {
      console.error(err);
    }
  };

  const goToMatch = () => {
    navigate("/match", { state: { username, group } });
  };

  const displayed = useMemo(() => players, [players]);

  return (
    <div className="player-page">
      <div className="player-header">
        <div>
          <h2>Players — {group}</h2>
          <div className="sub">
            Login: <b>{username}</b>
          </div>
        </div>
        <button className="btn" onClick={goToMatch}>
          ไปหน้า Match
        </button>
      </div>

      {/* ADD PLAYER */}
      <div className="add-player-box">
        <h3>เพิ่มผู้เล่นใหม่</h3>

        <input
          placeholder="ชื่อผู้เล่น"
          value={newPlayer.Player_Name}
          onChange={(e) =>
            setNewPlayer({ ...newPlayer, Player_Name: e.target.value })
          }
        />

        <select
          value={newPlayer.Player_Ranking}
          onChange={(e) =>
            setNewPlayer({ ...newPlayer, Player_Ranking: e.target.value })
          }
        >
          {RANKS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>

   
<div className="gender-box">
  <div className="gender-title">เพศ:</div>

  <label className="gender-item">
    <input
      type="radio"
      name="gender"
      value="ชาย"
      checked={newPlayer.Player_Gender === "ชาย"}
      onChange={(e) =>
        setNewPlayer({ ...newPlayer, Player_Gender: e.target.value })
      }
    />
    <span>ชาย</span>
  </label>

  <label className="gender-item">
    <input
      type="radio"
      name="gender"
      value="หญิง"
      checked={newPlayer.Player_Gender === "หญิง"}
      onChange={(e) =>
        setNewPlayer({ ...newPlayer, Player_Gender: e.target.value })
      }
    />
    <span>หญิง</span>
  </label>
  
</div>




        <button onClick={addPlayer}>เพิ่มผู้เล่น</button>
      </div>

      <button
  className="toggle-court-btn"
  onClick={() => setShowAddCourt(!showAddCourt)}
>
  {showAddCourt ? "ซ่อนการเพิ่มคอร์ท" : "แสดงการเพิ่มคอร์ท"}
</button>
{showAddCourt && (
<div className="court-box">
  <h3>จัดการคอร์ท</h3>

  <div className="court-checkbox-grid">
    {[...Array(16)].map((_, i) => {
      const courtNo = i + 1;
      return (
        <label key={courtNo} className="court-checkbox-item">
          <input
            type="checkbox"
            checked={selectedCourts.includes(courtNo)}
            onChange={() => toggleCourtSelect(courtNo)}
          />
          <span>คอร์ท {courtNo}</span>
        </label>
      );
    })}
  </div>

  <button onClick={addCourts}>
    เพิ่มคอร์ทที่เลือก ({selectedCourts.length})
  </button>

  <hr />

  <div className="court-list">
    {courts.map((c) => (
    <div
  key={c.id}
  className={`court-card ${
    c.Cort_Status === "Active" ? "active" : "check"
  }`}
>
        <b>คอร์ท {c.Cort}</b>
        <span>สถานะ: {c.Cort_Status}</span>

        <button onClick={() => toggleCourtStatus(c)}>
          {c.Cort_Status === "Active" ? "Check" : "Active"}
        </button>

        <button className="danger" onClick={() => deleteCourt(c.id)}>
          Delete
        </button>
      </div>
    ))}
  </div>
</div>
)}

      {/* SEARCH / SORT */}
      <div className="controls">
        <input
          placeholder="ค้นหา..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="">Default</option>
          <option value="ranking">Ranking</option>
          <option value="payment">Payment</option>
          <option value="timestamp">Date</option>
        </select>

        <select value={order} onChange={(e) => setOrder(e.target.value)}>
          <option value="DESC">DESC</option>
          <option value="ASC">ASC</option>
        </select>

        <button onClick={fetchAll}>Refresh</button>
      </div>

      <div className="stats-and-list">
        <div className="stats-card">
          <h4>จำนวนผู้เล่นแต่ละ Ranking</h4>
          <SmallBarChart data={stats} />

          <div className="total-pay">
            ยอดรวมค่าคอร์ท: <b>{totalPay}</b>
          </div>
        </div>

        <div className="list-card">
          <h4>
            รายชื่อผู้เล่น ({displayed.length}) {loading && "Loading..."}
          </h4>

          <div className="player-list-grid">
            {displayed.map((p) => (
              <div
                key={p.id}
                className={`player-card ${
                  p.Player_Status === "Play"
                    ? "play"
                    : p.Player_Status === "Bye"
                    ? "bye"
                    : "active"
                }`}
              >
                {editingId === p.id ? (
                  <>
                    <input
                      value={editForm.Player_Name}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          Player_Name: e.target.value,
                        })
                      }
                    />

                    <select
                      value={editForm.Player_Ranking}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          Player_Ranking: e.target.value,
                        })
                      }
                    >
                      {RANKS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>

              

                    <div className="buttons">
                      <button onClick={saveEdit}>Save</button>
                      <button className="danger" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="player-top">
                      <div className="player-name">{p.Player_Name}</div>
                      <div className="player-rank-pill">
                        {p.Player_Ranking}
                      </div>
                    </div>

                    <div className="player-mid">

  {/* แสดงเพศ */}
  <div>
    {p.Player_Gender === "ชาย" ? " ชาย" : " หญิง"}
  </div>

  {/* ยอดชำระ */}


  {/* เวลา */}
  <div>
    {p.TimeStamp && new Date(p.TimeStamp).toLocaleString()}
  </div>

</div>


                    <div className="player-bottom">
                      <div className="status">{p.Player_Status}</div>

                      <div className="buttons">
                        <button onClick={() => onEdit(p)}>Edit</button>

                        <button
                          className="danger"
                          onClick={() => onDelete(p.id)}
                        >
                          Delete
                        </button>

                        <button
                          className="bye"
                          onClick={() => onBye(p.id, p.Player_Status)}
                        >
                          Bye
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Player;
