import type { ReactNode } from "react";
import { Icon } from "./Icon";

interface AuthCardProps {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/** The centred card from the wireframe's log-in and sign-up modals, used as a full page. */
export function AuthCard({ eyebrow, title, intro, children, footer }: AuthCardProps) {
  return (
    <div className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="brand-mark auth-brand" aria-hidden="true">
          <Icon name="bookOpen" size={21} />
        </span>
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="auth-title">{title}</h1>
        {intro && <div className="auth-intro">{intro}</div>}
        {children}
        {footer && <div className="auth-switch">{footer}</div>}
      </section>
    </div>
  );
}
