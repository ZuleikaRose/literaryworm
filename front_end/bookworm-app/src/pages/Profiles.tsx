import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { useStore } from "../store/context";
import { Placeholder } from "./Placeholder";

export default function Profiles() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  return (
    <Placeholder title="Who's reading?" phase={2}>
      <ul className="placeholder-profiles">
        {state.profiles.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                dispatch({ type: "selectProfile", id: p.id });
                navigate("/browse");
              }}
            >
              <Avatar name={p.name} avatar={p.avatar} size={28} /> {p.name}
            </button>
          </li>
        ))}
      </ul>
    </Placeholder>
  );
}
