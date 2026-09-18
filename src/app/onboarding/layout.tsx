export default function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md flex-1">{children}</div>
    </div>
  );
}
