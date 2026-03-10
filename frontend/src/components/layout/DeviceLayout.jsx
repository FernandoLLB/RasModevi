import TopBar from './TopBar'

export default function DeviceLayout({ children, onSearch, searchValue, hideSearch }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onSearch={hideSearch ? undefined : onSearch} searchValue={searchValue} />
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
