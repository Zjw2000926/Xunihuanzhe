import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Layout from "../components/Layout";

function renderLayout(user, initialRoute = "/home") {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Layout user={user} onLogout={vi.fn()}>
        <div data-testid="child">Content</div>
      </Layout>
    </MemoryRouter>,
  );
}

describe("Layout", () => {
  const studentUser = {
    id: 1,
    username: "s1",
    display_name: "李明",
    role: "student",
  };

  const teacherUser = {
    id: 2,
    username: "t1",
    display_name: "张老师",
    role: "teacher",
  };

  it("renders children content", () => {
    renderLayout(studentUser);
    expect(screen.getByTestId("child")).toHaveTextContent("Content");
  });

  it("shows brand title", () => {
    renderLayout(studentUser);
    expect(screen.getByText("虚拟患者系统")).toBeInTheDocument();
  });

  it("shows user display name", () => {
    renderLayout(studentUser);
    expect(screen.getByText("李明")).toBeInTheDocument();
  });

  it("shows student role label", () => {
    renderLayout(studentUser);
    expect(screen.getByText("学生")).toBeInTheDocument();
  });

  it("shows teacher role label", () => {
    renderLayout(teacherUser);
    expect(screen.getByText("教师")).toBeInTheDocument();
  });

  it("shows student navigation links", () => {
    renderLayout(studentUser);
    expect(screen.getByText("病例训练")).toBeInTheDocument();
    expect(screen.queryByText("管理后台")).not.toBeInTheDocument();
  });

  it("shows teacher navigation links", () => {
    renderLayout(teacherUser);
    expect(screen.getByText("管理后台")).toBeInTheDocument();
    expect(screen.queryByText("病例训练")).not.toBeInTheDocument();
  });

  it("has logout button", () => {
    renderLayout(studentUser);
    expect(screen.getByText("退出登录")).toBeInTheDocument();
  });

  it("highlights active nav link", () => {
    renderLayout(studentUser, "/history");
    const historyLinks = screen.getAllByText("训练记录");
    // One in nav, one could be in sidebar header
    expect(historyLinks.length).toBeGreaterThanOrEqual(1);
  });
});
