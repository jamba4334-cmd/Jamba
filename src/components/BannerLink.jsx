import React from 'react';
import { Link } from 'react-router-dom';

export default function BannerLink({ link, openInNewTab, className, style, children }) {
    // If there is no link at all, just render a div
    if (!link) {
        return (
            <div className={className} style={style}>
                {children}
            </div>
        );
    }

    // Determine if it should be an external anchor tag
    const isExternal = link.startsWith('http') || openInNewTab;

    if (isExternal) {
        const href = link.startsWith('http') ? link : `https://${link}`;
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
                {children}
            </a>
        );
    }

    // Otherwise, use React Router for smooth internal navigation
    const internalPath = link.startsWith('/') ? link : `/${link}`;
    return (
        <Link to={internalPath} className={className} style={style}>
            {children}
        </Link>
    );
}