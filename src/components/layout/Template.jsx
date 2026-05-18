import Header from "./Header";

export default function Template({ children }) {
  return (
    <div>
      <Header />
      <main>{children}</main>
    </div>
  );
}
