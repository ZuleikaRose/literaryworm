import { startTransition, useId } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePopover } from "../lib/usePopover";
import { useSignOut } from "../lib/useSignOut";
import { useActiveProfile, useStore } from "../store/context";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

export function ProfileMenu() {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const navigate = useNavigate();
  const signOutAndLeave = useSignOut();
  const { open, toggle, close, wrapRef, triggerRef } = usePopover();
  const menuId = useId();
  if (!profile) return null;

  const others = state.profiles.filter((p) => p.id !== profile.id);

  const switchTo = () => {
    close(false);
    // Switching always goes back through Who's reading?, so PIN-locked profiles still ask.
    // Same transition as the navigation, so the page's guard doesn't redirect first.
    navigate("/profiles");
    startTransition(() => dispatch({ type: "selectProfile", id: null }));
  };

  const signOut = () => {
    close(false);
    signOutAndLeave();
  };

  return (
    <div className="popover-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="profile-button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggle}
      >
        <Avatar name={profile.name} avatar={profile.avatar} />
        <span className="profile-button-name">{profile.name}</span>
        <span className="visually-hidden">, profile menu</span>
      </button>
      {open && (
        <div id={menuId} className="popover profile-menu">
          {others.length > 0 && (
            <>
              <p className="popover-label">Switch profile</p>
              <ul className="menu-list">
                {others.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="menu-item" onClick={switchTo}>
                      <Avatar name={p.name} avatar={p.avatar} size={26} />
                      {p.name}
                      {p.pin && <Icon name="lock" size={14} className="menu-item-end" />}
                    </button>
                  </li>
                ))}
              </ul>
              <hr className="menu-sep" />
            </>
          )}
          <ul className="menu-list">
            <li>
              <button type="button" className="menu-item" onClick={switchTo}>
                <Icon name="users" size={18} /> Manage profiles
              </button>
            </li>
            <li>
              <Link className="menu-item" to="/account" onClick={() => close(false)}>
                <Icon name="settings" size={18} /> Account
              </Link>
            </li>
            <li>
              <button type="button" className="menu-item" onClick={signOut}>
                <Icon name="logOut" size={18} /> Sign out
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
