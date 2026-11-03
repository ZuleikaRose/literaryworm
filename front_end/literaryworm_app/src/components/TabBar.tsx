import { tk } from "../lib/i18n";
import { useT } from "../lib/useT";
import { NavLink } from "react-router-dom";
import { Icon, type IconName } from "./Icon";

const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: "/browse", label: tk("Home"), icon: "home" },
  { to: "/search", label: tk("Search"), icon: "search" },
  { to: "/library", label: tk("Library"), icon: "library" },
  { to: "/account", label: tk("Account"), icon: "user" },
];

/** Bottom navigation on phones. */
export function TabBar() {
  const t = useT();
  return (
    <nav className="tab-bar" aria-label={t("Primary")}>
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to}>
          <Icon name={tab.icon} size={22} />
          <span>{t(tab.label)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
