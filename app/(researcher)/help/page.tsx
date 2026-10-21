import Link from "next/link";
import {
  ArrowLeft,
  MessageSquare,
  SlidersHorizontal,
  ShieldCheck,
} from "lucide-react";
export default function Help() {
  return (
    <>
      <Link className="back-link" href="/">
        <ArrowLeft size={14} /> Your workspace
      </Link>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">FROM IDEA TO COMPUTE</span>
          <h1>A conversation. A configuration.</h1>
          <p>Here’s how your GPU request comes together.</p>
        </div>
      </div>
      <div className="help-grid">
        {[
          {
            Icon: MessageSquare,
            title: "Describe your workload",
            text: "Tell the assistant your model, dataset, and whether you’re training or running inference. It asks for missing essentials and fills in sensible defaults.",
          },
          {
            Icon: SlidersHorizontal,
            title: "Review and refine",
            text: "Your summary updates as you chat. Change any workload value by telling the assistant. Review the recommended GPU, memory estimates, and assumptions.",
          },
          {
            Icon: ShieldCheck,
            title: "Confirm your request",
            text: "Submit the configuration to your platform team. Your request becomes read-only, and its timeline reflects the actual review and provisioning status.",
          },
        ].map(({ Icon, title, text }, i) => (
          <article key={title}>
            <span className="icon-tile">
              <Icon size={21} />
            </span>
            <span className="eyebrow">STEP 0{i + 1}</span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </>
  );
}
