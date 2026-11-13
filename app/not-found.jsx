import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '85vh',
        background: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '560px',
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Cute 404 Illustration matching design */}
        <div style={{ marginBottom: '32px', position: 'relative' }}>
          <svg
            width="280"
            height="180"
            viewBox="0 0 280 180"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: 'block', margin: '0 auto' }}
          >
            {/* Soft ground shadow under browser */}
            <ellipse cx="108" cy="162" rx="46" ry="5" fill="#E2E8F0" />

            {/* Spark / Motion lines to the left */}
            <line x1="56" y1="78" x2="68" y2="88" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="50" y1="96" x2="62" y2="98" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />

            {/* Browser window box */}
            <rect
              x="72"
              y="85"
              width="88"
              height="72"
              rx="8"
              fill="#E0F2FE"
              stroke="#7DD3FC"
              strokeWidth="3.5"
            />
            {/* Browser header line */}
            <line x1="72" y1="102" x2="160" y2="102" stroke="#7DD3FC" strokeWidth="2.5" />

            {/* Browser 3 dots */}
            <circle cx="82" cy="94" r="1.8" fill="#94A3B8" />
            <circle cx="88" cy="94" r="1.8" fill="#94A3B8" />
            <circle cx="94" cy="94" r="1.8" fill="#94A3B8" />

            {/* Cute Face: Eyes */}
            <circle cx="102" cy="122" r="3.2" fill="#475569" />
            <circle cx="130" cy="122" r="3.2" fill="#475569" />

            {/* Blushing pink cheeks */}
            <ellipse cx="94" cy="130" rx="3.5" ry="3" fill="#FCA5A5" opacity="0.85" />
            <ellipse cx="138" cy="130" rx="3.5" ry="3" fill="#FCA5A5" opacity="0.85" />

            {/* Sad / Surprised open mouth */}
            <ellipse cx="116" cy="134" rx="4.5" ry="5" fill="#64748B" />

            {/* 404 Speech Bubble */}
            <path
              d="M 195 20 
                 A 46 46 0 1 1 154 94 
                 C 146 102 136 108 126 111 
                 C 140 109 152 103 160 96 
                 A 46 46 0 0 1 195 20 Z"
              fill="#29B6F6"
            />

            {/* 404 Text inside bubble */}
            <text
              x="195"
              y="74"
              fill="#FFFFFF"
              fontSize="35"
              fontWeight="900"
              fontFamily="system-ui, -apple-system, sans-serif"
              textAnchor="middle"
              letterSpacing="1px"
            >
              404
            </text>
          </svg>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: '38px',
            fontWeight: '600',
            color: '#38BDF8',
            letterSpacing: '0.04em',
            margin: '0 0 24px 0',
            textTransform: 'uppercase',
          }}
        >
          PAGE NOT FOUND
        </h1>

        {/* Subtitle description */}
        <div
          style={{
            fontSize: '15px',
            color: '#64748B',
            lineHeight: '1.75',
            margin: '0 0 32px 0',
          }}
        >
          <div>We looked everywhere for this page.</div>
          <div>Are you sure the website URL is correct?</div>
          <div>Get in touch with the site owner.</div>
        </div>

        {/* Pill Button */}
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 28px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#0284C7',
            background: '#FFFFFF',
            border: '1.5px solid #38BDF8',
            borderRadius: '9999px',
            textDecoration: 'none',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
          }}
        >
          Go Back Home
        </Link>
      </div>
    </div>
  );
}
