import { useParams } from "react-router-dom";
import MonitorMatch from "./MonitorMatch";

export default function MonitorPage() {
  const { group } = useParams();
  console.log("Monitor group:", group);
  return <MonitorMatch group={group} />;
}
