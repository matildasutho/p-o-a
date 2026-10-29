import Header from "./Header";
import PageTransitions from "./PageTransitions";

export default function Template({ children }) {
  return (
    <div>
      <PageTransitions />
      <Header />
      <main>{children}</main>
    </div>
  );
}
