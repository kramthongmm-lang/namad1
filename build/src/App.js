import { Routes, Route } from "react-router-dom";
import { useParams } from "react-router-dom";

import Login from "./component/Login";
import Group from "./component/Group";
import Player from "./component/Player";
import Match from "./component/Match";
import MonitorPage from "./component/MonitorPage";
import NextMatchQueue from "./component/NextMatchQueue";
import WaitTime from "./component/WaitTime";
const WaitTimeWrapper = () => {
  const { group } = useParams();
  console.log("WAITTIME GROUP =", group); // ⭐ debug

  return <WaitTime group={decodeURIComponent(group)} />;
};
function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/group" element={<Group />} />
      <Route path="/player" element={<Player />} />
      <Route path="/match" element={<Match />} />
<Route path="/nextqueue/:group" element={<NextMatchQueue />} />
      {/* >>> เพิ่ม ROUTE สำหรับหน้า MONITOR <<< */}
      <Route path="/monitor/:group" element={<MonitorPage />} />
      
          <Route path="/waittime/:group" element={<WaitTimeWrapper />}/>

    </Routes>

  );
}

export default App;
