import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { BarChart3, ClipboardList, HelpCircle, Home, Menu, Settings, Stethoscope, X } from "lucide-react";

const studentLinks = [
  { to: "/home", icon: Home, label: "首页" },
  { to: "/cases", icon: Stethoscope, label: "病例训练" },
  { to: "/history", icon: ClipboardList, label: "训练记录" },
  { to: "/qa", icon: HelpCircle, label: "护理问答" },
  { to: "/stats", icon: BarChart3, label: "训练统计" },
];

const teacherLinks = [
  { to: "/home", icon: Home, label: "首页" },
  { to: "/history", icon: ClipboardList, label: "训练记录" },
  { to: "/qa", icon: HelpCircle, label: "护理问答" },
  { to: "/stats", icon: BarChart3, label: "训练统计" },
  { to: "/admin", icon: Settings, label: "管理后台" },
];

export default function AppShell({ children, user, onLogout }) {
  const navigate = useNavigate();
  const isTeacher = user?.role === "teacher";
  const links = isTeacher ? teacherLinks : studentLinks;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  const handleLogout = () => {
    onLogout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      {mobileMenuOpen && <div className="sidebar-overlay" onClick={closeMenu} />}

      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <h2>虚拟患者系统</h2>
          <span>护理病史采集训练</span>
        </div>

        <nav className="sidebar-nav">
          {links.map((link) => {
            const Icon = link.icon;
            return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/home"}
              onClick={closeMenu}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              <Icon className="nav-icon" size={16} />
              {link.label}
            </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar-dot">
              {(user?.display_name || "U")[0]}
            </div>
            <div className="info">
              <div className="name">{user?.display_name}</div>
              <div className="role">{isTeacher ? "教师" : "学生"}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </aside>

      <main className="main-content">
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label={mobileMenuOpen ? "关闭菜单" : "打开菜单"}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        {children}
      </main>
    </div>
  );
}
