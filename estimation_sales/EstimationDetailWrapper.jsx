// src/components/EstimationDetailWrapper.jsx

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EstimationDetailAudit from "./EstimationDetailAudit";
import { useB2JEmployees } from "../../hooks/useB2JEmployees";



const EstimationDetailWrapper = ({ role }) => {
    // 1. Extract the dynamic segment from the URL
    const { estimationId } = useParams();
    const navigate = useNavigate();

    const handleBack = () => {
        // 2. Define back navigation (back to the list page)
        navigate('/sales/estimations/logs');
    };

    if (!estimationId) return <div>Invalid Estimation ID</div>;

    return (
        <EstimationDetailAudit
            estimationId={estimationId}
            onBack={handleBack}
            // Pass any other required props (like role, etc.)
            // The original component assumes 'onBack' is passed, which is now handled.
        />
    );
};

export default EstimationDetailWrapper;