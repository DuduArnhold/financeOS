export default function Loader() {
  return (
    <div className="fixed inset-0 bg-[#090d16]/80 backdrop-blur-md flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20"></div>
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
        </div>
        <p className="text-slate-400 text-xs tracking-wider uppercase font-medium animate-pulse">FinanceOS</p>
      </div>
    </div>
  )
}
