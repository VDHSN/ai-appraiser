import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandLogo } from "../BrandLogo";

/**
 * Helper to check if an element has a CSS class
 */
function hasClass(element: Element | null, className: string): boolean {
  return element?.classList.contains(className) ?? false;
}

/**
 * Helper to check if an element has all specified CSS classes
 */
function hasClasses(element: Element | null, classNames: string[]): boolean {
  return classNames.every((cn) => hasClass(element, cn));
}

describe("BrandLogo", () => {
  it("renders the brand name with correct parts", () => {
    render(<BrandLogo />);

    // The brand name should be split into three parts
    expect(screen.getByText("appr")).toBeDefined();
    expect(screen.getByText("AI")).toBeDefined();
    expect(screen.getByText("ser")).toBeDefined();
  });

  it("renders AI with gold accent color", () => {
    render(<BrandLogo />);

    const aiElement = screen.getByText("AI");
    expect(aiElement.className).toContain("text-[var(--accent-gold)]");
  });

  it("renders AI with bold font weight", () => {
    render(<BrandLogo />);

    const aiElement = screen.getByText("AI");
    expect(hasClass(aiElement, "font-bold")).toBe(true);
  });

  it("renders non-AI text with light font weight", () => {
    render(<BrandLogo />);

    const apprElement = screen.getByText("appr");
    const serElement = screen.getByText("ser");

    expect(hasClass(apprElement, "font-light")).toBe(true);
    expect(hasClass(serElement, "font-light")).toBe(true);
  });

  it("applies small size classes when size is sm", () => {
    render(<BrandLogo size="sm" />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(hasClasses(heading, ["text-2xl", "sm:text-3xl"])).toBe(true);
  });

  it("applies medium size classes when size is md", () => {
    render(<BrandLogo size="md" />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(hasClasses(heading, ["text-4xl", "sm:text-5xl"])).toBe(true);
  });

  it("applies large size classes when size is lg (default)", () => {
    render(<BrandLogo />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(
      hasClasses(heading, ["text-5xl", "sm:text-6xl", "md:text-7xl"]),
    ).toBe(true);
  });

  it("applies custom className when provided", () => {
    render(<BrandLogo className="custom-class" />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(hasClass(heading, "custom-class")).toBe(true);
  });
});
