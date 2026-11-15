import React from "react";
import { Card } from "./Card";
import { Badge } from "./Badge";
import { HeartHandshake } from "lucide-react";

export interface TestimonialCardProps {
  quote: string;
  author: string;
  context: string;
  careOutcome?: string;
  avatarInitials?: string;
  className?: string;
}

export function TestimonialCard({
  quote,
  author,
  context,
  careOutcome,
  avatarInitials,
  className = "",
}: TestimonialCardProps) {
  return (
    <Card
      variant="default"
      padding="lg"
      className={`flex flex-col justify-between ${className}`}
    >
      <div>
        {careOutcome && (
          <div className="mb-4">
            <Badge variant="brand" size="sm" icon={<HeartHandshake className="h-3 w-3" />}>
              {careOutcome}
            </Badge>
          </div>
        )}

        <blockquote className="text-sm sm:text-base leading-relaxed text-[#191716] italic font-normal">
          &ldquo;{quote}&rdquo;
        </blockquote>
      </div>

      <div className="mt-6 flex items-center gap-3 border-t border-[#E2DDD5] pt-4">
        {avatarInitials ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EBF5F3] text-xs font-bold text-[#0E6156] border border-[#C8E4DE]">
            {avatarInitials}
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4F0EB] text-xs font-bold text-[#5C5650]">
            {author.charAt(0)}
          </div>
        )}

        <div>
          <div className="text-xs font-bold text-[#191716]">{author}</div>
          <div className="text-[11px] text-[#8A8279]">{context}</div>
        </div>
      </div>
    </Card>
  );
}
