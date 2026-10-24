import { useNavigate } from "react-router-dom";
import { useStore } from "../store/context";
import { Placeholder } from "./Placeholder";

export default function SignIn() {
  const { dispatch } = useStore();
  const navigate = useNavigate();
  return (
    <Placeholder title="Log in" phase={1}>
      <button
        type="button"
        className="primary-button"
        onClick={() => {
          dispatch({ type: "startDemo" });
          navigate("/profiles");
        }}
      >
        Try the demo
      </button>
    </Placeholder>
  );
}
