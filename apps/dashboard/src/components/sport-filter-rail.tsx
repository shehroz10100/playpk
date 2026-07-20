'use client';

import Image from 'next/image';
import {
  featuredSportsForRail,
  orderSportsForRail,
  resolveSportCover,
  type SportDto,
} from '@playpk/shared-types';
import { cn } from '@/lib/utils';

type Props = {
  sports: SportDto[];
  /** Empty string = All */
  value: string;
  onChange: (sportNameOrId: string) => void;
  /** Select by sport id (forms) instead of name (filters). */
  valueMode?: 'name' | 'id';
  featuredOnly?: boolean;
  showAll?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

const sizeMap = {
  sm: 'h-28 w-[4.25rem] sm:h-32 sm:w-[4.75rem]',
  md: 'h-36 w-[5rem] sm:h-40 sm:w-[5.5rem] md:h-44 md:w-24 lg:h-48 lg:w-[6.5rem]',
  lg: 'h-40 w-[5.5rem] sm:h-48 sm:w-28 md:h-52 md:w-32',
};

export function SportFilterRail({
  sports,
  value,
  onChange,
  valueMode = 'name',
  featuredOnly = true,
  showAll = true,
  className,
  size = 'md',
}: Props) {
  const items = featuredOnly ? featuredSportsForRail(sports) : orderSportsForRail(sports);
  const chipClass = sizeMap[size];

  function isActive(sport: SportDto) {
    if (valueMode === 'id') return value === sport.id;
    return value === sport.name;
  }

  function pick(sport: SportDto) {
    onChange(valueMode === 'id' ? sport.id : sport.name);
  }

  return (
    <div
      className={cn(
        'sport-rail -mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain px-1 pb-2 pt-1 sm:gap-3',
        className,
      )}
    >
      {showAll ? (
        <SportChip
          label="All sports"
          cover={resolveSportCover('All')}
          active={!value}
          onClick={() => onChange('')}
          chipClass={chipClass}
        />
      ) : null}

      {items.map((sport) => {
        const active = isActive(sport);
        const cover = resolveSportCover(sport.name, sport.iconUrl);
        return (
          <SportChip
            key={sport.id}
            label={sport.name}
            cover={cover}
            active={active}
            onClick={() => pick(sport)}
            chipClass={chipClass}
          />
        );
      })}
    </div>
  );
}

function SportChip({
  label,
  cover,
  active,
  onClick,
  chipClass,
}: {
  label: string;
  cover: string;
  active: boolean;
  onClick: () => void;
  chipClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative shrink-0 snap-start overflow-hidden rounded-2xl border-2 transition duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
        chipClass,
        active
          ? 'border-brand scale-[1.03]'
          : 'border-transparent hover:border-brand/40 hover:scale-[1.01]',
      )}
      aria-pressed={active}
    >
      <Image
        src={cover}
        alt=""
        fill
        sizes="(max-width:640px) 72px, (max-width:1024px) 88px, 112px"
        className="object-cover"
        loading="lazy"
      />
      <span
        className={cn(
          'absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/35 to-navy/15',
          active && 'from-brand/90 via-brand/45 to-brand/20',
        )}
      />
      <span
        className={cn(
          'relative z-10 flex h-full items-end justify-center px-1.5 pb-3 text-center text-[10px] font-bold leading-tight text-white drop-shadow sm:text-[11px] md:text-xs',
        )}
      >
        {label}
      </span>
    </button>
  );
}
