"use client";

import { useState } from "react";

type FaqItem = {
  question: string;
  answer: string;
};

export function LandingFaq({ items }: { items: readonly FaqItem[] }) {
  const [open, setOpen] = useState(0);

  return (
    <div>
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={item.question} className="border-b border-[#E7DCC8] py-4">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 text-left text-lg font-bold text-[#123B7A]"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : index)}
            >
              <span>{item.question}</span>
              <span className="text-[22px] text-[#F79521]">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen ? <p className="mt-3 text-[15px] leading-relaxed text-[#4A5568]">{item.answer}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
