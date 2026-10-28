import { NavLink } from "react-router-dom";
import { Icon, type IconName } from "./Icon";

const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: "/browse", label: "Home", icon: "home" },
  { to: "/search", label: "Search", icon: "search" },
  { to: "/library", label: "Library", icon: "library" },
  { to: "/account", label: "Account", icon: "user" },
];

/** Bottom navigation on phones. */
export function TabBar() {
  return (
    <nav className="tab-bar" aria-label="Primary">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to}>
          <Icon name={t.icon} size={22} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
