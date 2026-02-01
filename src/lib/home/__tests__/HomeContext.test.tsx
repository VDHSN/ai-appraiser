import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeProvider, useHome } from "../HomeContext";

function TestComponent() {
  const context = useHome();
  return (
    <div>
      <span data-testid="has-context">{context ? "yes" : "no"}</span>
    </div>
  );
}

describe("HomeContext", () => {
  describe("with URL-based routing", () => {
    it("provides a minimal context", () => {
      render(
        <HomeProvider>
          <TestComponent />
        </HomeProvider>,
      );

      expect(screen.getByTestId("has-context").textContent).toBe("yes");
    });

    it("useHome returns context outside of provider (empty object)", () => {
      // With the new implementation, useHome returns {} even outside provider
      // since we use a default value in createContext
      function OutsideComponent() {
        const context = useHome();
        return <span data-testid="context-type">{typeof context}</span>;
      }

      render(<OutsideComponent />);
      expect(screen.getByTestId("context-type").textContent).toBe("object");
    });
  });

  describe("deprecated methods", () => {
    it("startChat is undefined in new context", () => {
      function MethodTestComponent() {
        const { startChat } = useHome();
        return (
          <span data-testid="start-chat">
            {startChat === undefined ? "undefined" : "defined"}
          </span>
        );
      }

      render(
        <HomeProvider>
          <MethodTestComponent />
        </HomeProvider>,
      );

      expect(screen.getByTestId("start-chat").textContent).toBe("undefined");
    });

    it("resumeChat is undefined in new context", () => {
      function MethodTestComponent() {
        const { resumeChat } = useHome();
        return (
          <span data-testid="resume-chat">
            {resumeChat === undefined ? "undefined" : "defined"}
          </span>
        );
      }

      render(
        <HomeProvider>
          <MethodTestComponent />
        </HomeProvider>,
      );

      expect(screen.getByTestId("resume-chat").textContent).toBe("undefined");
    });

    it("resetToLanding is undefined in new context", () => {
      function MethodTestComponent() {
        const { resetToLanding } = useHome();
        return (
          <span data-testid="reset-to-landing">
            {resetToLanding === undefined ? "undefined" : "defined"}
          </span>
        );
      }

      render(
        <HomeProvider>
          <MethodTestComponent />
        </HomeProvider>,
      );

      expect(screen.getByTestId("reset-to-landing").textContent).toBe(
        "undefined",
      );
    });
  });
});
