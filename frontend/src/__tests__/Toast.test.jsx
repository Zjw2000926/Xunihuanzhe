import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "../components/Toast";

// Helper component to trigger toasts
function ToastTester({ onToast }) {
  const { toast, success, error, warning, info } = useToast();

  const handleToast = () => {
    const id = toast("普通消息", "info");
    onToast?.(id);
  };

  return (
    <div>
      <button onClick={handleToast}>Show Toast</button>
      <button onClick={() => success("成功消息")}>Success</button>
      <button onClick={() => error("错误消息")}>Error</button>
      <button onClick={() => warning("警告消息")}>Warning</button>
      <button onClick={() => info("提示消息")}>Info</button>
    </div>
  );
}

describe("ToastProvider", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders children without toast", () => {
    render(
      <ToastProvider>
        <div data-testid="child">Hello</div>
      </ToastProvider>,
    );
    expect(screen.getByTestId("child")).toHaveTextContent("Hello");
  });

  it("shows a toast message on click", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTester />
      </ToastProvider>,
    );

    await user.click(screen.getByText("Show Toast"));
    expect(screen.getByText("普通消息")).toBeInTheDocument();
  });

  it("shows different toast types", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTester />
      </ToastProvider>,
    );

    await user.click(screen.getByText("Success"));
    expect(screen.getByText("成功消息")).toBeInTheDocument();

    await user.click(screen.getByText("Error"));
    expect(screen.getByText("错误消息")).toBeInTheDocument();

    await user.click(screen.getByText("Warning"));
    expect(screen.getByText("警告消息")).toBeInTheDocument();

    await user.click(screen.getByText("Info"));
    expect(screen.getByText("提示消息")).toBeInTheDocument();
  });

  it("removes toast on close button click", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTester />
      </ToastProvider>,
    );

    await user.click(screen.getByText("Show Toast"));
    expect(screen.getByText("普通消息")).toBeInTheDocument();

    // Click the X close button
    const closeButtons = document.querySelectorAll(".toast-close");
    await user.click(closeButtons[0]);

    // Toast should be removed
    expect(screen.queryByText("普通消息")).not.toBeInTheDocument();
  });

  it("auto-dismisses toast after duration", async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTester />
      </ToastProvider>,
    );

    await act(async () => {
      screen.getByText("Show Toast").click();
    });

    expect(screen.getByText("普通消息")).toBeInTheDocument();

    // Fast-forward past default 4000ms + animation
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText("普通消息")).not.toBeInTheDocument();
  });

  it("throws error when useToast used outside provider", () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    function BadComponent() {
      useToast();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow(
      "useToast must be inside ToastProvider",
    );

    spy.mockRestore();
  });
});
