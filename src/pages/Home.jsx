import { useState } from "react";

export default function Home() {
  const [address, setAddress] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (address.trim()) setSubmitted(true);
  }

  return (
    <main className="page">
      <header>
        <h1>Civic Atlas</h1>
        <p className="lede">
          Enter an address to see who represents you in Congress, with their votes, bills,
          committees, and campaign finance, drawn from official sources.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="lookup">
        <label htmlFor="address">Address</label>
        <div className="row">
          <input
            id="address"
            type="text"
            autoComplete="street-address"
            placeholder="123 Main St, City, State"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setSubmitted(false);
            }}
          />
          <button type="submit">Look up</button>
        </div>
      </form>

      {submitted && (
        <p className="notice">Address lookup is not connected yet.</p>
      )}

      <footer>
        Data sources: Congress.gov, House Clerk, Senate.gov, FEC.
      </footer>
    </main>
  );
}
