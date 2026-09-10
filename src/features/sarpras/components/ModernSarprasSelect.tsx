import React, { useState, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface ModernSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeClass?: string;
}

interface ModernSarprasSelectProps {
  label?: string;
  required?: boolean;
  placeholder?: string;
  options: ModernSelectOption[];
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  searchable?: boolean;
  allowCustomInput?: boolean;
  customValue?: string;
  onCustomChange?: (val: string) => void;
  customPlaceholder?: string;
  compact?: boolean;
  className?: string;
}

export const ModernSarprasSelect: React.FC<ModernSarprasSelectProps> = ({
  label,
  required,
  placeholder = '-- Pilih --',
  options,
  value,
  onChange,
  icon,
  disabled = false,
  searchable = false,
  allowCustomInput = false,
  customValue = '',
  onCustomChange,
  customPlaceholder = 'Ketik nama spesifik...',
  compact = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, search]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  const showSearchInput = searchable || options.length > 6;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-extrabold text-[#023246] flex items-center gap-1.5">
          {icon && <span className="text-[#18536B]">{icon}</span>}
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(true)}
        className={`w-full text-left bg-white border border-slate-200/90 hover:border-[#18536B]/50 transition-all flex items-center justify-between gap-2.5 cursor-pointer select-none active:scale-[0.99] ${
          compact ? 'px-3 py-2 rounded-xl text-xs' : 'px-3.5 py-2.5 rounded-xl text-xs sm:text-sm'
        } ${isOpen ? 'border-[#023246] ring-2 ring-[#023246]/10' : ''} ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption?.icon && (
            <span className="text-slate-500 shrink-0">{selectedOption.icon}</span>
          )}
          <span className="font-semibold text-[#023246] truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded-md shrink-0 ${
                selectedOption.badgeClass || 'bg-slate-100 text-slate-700'
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#023246]' : ''
          }`}
        />
      </button>

      {/* Input manual jika memilih opsi 'LAINNYA' */}
      {allowCustomInput && value === 'LAINNYA' && onCustomChange && (
        <div className="pt-1 animate-in fade-in duration-200">
          <input
            type="text"
            placeholder={customPlaceholder}
            value={customValue}
            onChange={(e) => onCustomChange(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
            required
            autoFocus
          />
        </div>
      )}

      {/* Bottom Sheet / Popover Modal on Mobile */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-100 max-h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#18536B]" />
                <h4 className="text-xs sm:text-sm font-extrabold text-[#023246]">
                  {label ? `Pilih ${label}` : 'Pilih Opsi'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSearch('');
                }}
                className="w-7 h-7 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Bar jika opsi banyak */}
            {showSearchInput && (
              <div className="p-3 border-b border-slate-100 bg-white">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ketik untuk mencari..."
                    className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 outline-none focus:ring-2 focus:ring-[#18536B]/20 transition-all"
                    autoFocus
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Opsi List */}
            <div className="overflow-y-auto p-2 space-y-1 flex-1 divide-y divide-slate-50">
              {filteredOptions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                  Tidak ada opsi yang cocok dengan "{search}"
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer min-h-[46px] active:scale-[0.99] ${
                        isSelected
                          ? 'bg-[#18536B]/10 text-[#023246] font-extrabold border-l-3 border-[#18536B]'
                          : 'hover:bg-slate-50 text-slate-700 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {opt.icon && <span className="text-slate-500 shrink-0">{opt.icon}</span>}
                        <span className="text-xs sm:text-sm truncate">{opt.label}</span>
                        {opt.badge && (
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md shrink-0 ${
                              opt.badgeClass || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[#18536B] text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
