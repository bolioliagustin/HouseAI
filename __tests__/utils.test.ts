import { cn } from "@/lib/utils";

describe("cn utility", () => {
    it("should merge classes correctly", () => {
        expect(cn("bg-red-500", "text-white")).toBe("bg-red-500 text-white");
    });

    it("should handle conditional classes", () => {
        expect(cn("bg-red-500", false && "text-white", "p-4")).toBe("bg-red-500 p-4");
    });

    it("should resolve tailwind conflicts", () => {
        expect(cn("p-4 p-2")).toBe("p-2");
    });
});
