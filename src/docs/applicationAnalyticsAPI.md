# Application Analytics API Documentation

This document describes the Application Analytics API endpoints for tracking and analyzing application data by country, role, and time period.

## Base URL
All endpoints are prefixed with `/api/application-analytics`

## Authentication
All endpoints require authentication and appropriate permissions:
- `getApplicationAnalytics` - Required for GET endpoints
- `postApplicationAnalytics` - Required for POST endpoints

## Endpoints

### 1. Get Applications Data

**GET** `/applications`

Fetch application data for the selected time frame with optional role filtering. Supports both preset filters and custom date ranges.

#### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `filter` | string | No* | Time period filter (`weekly`, `monthly`, `yearly`) | `monthly` |
| `startDate` | string | No* | Custom start date (ISO format) | `2024-03-01` |
| `endDate` | string | No* | Custom end date (ISO format) | `2024-05-31` |
| `roles` | string | No | JSON array of roles to filter by | `["Developer", "Designer"]` |

> *Note: Either use `filter` OR `startDate` + `endDate`. For custom date ranges, hover comparison is disabled.

#### Example Request

```bash
GET /api/application-analytics/applications?filter=monthly&roles=["Developer","Designer"]
```

#### Example Response

```json
{
  "data": [
    {
      "country": "US",
      "totalApplicants": 150,
      "roles": ["Developer", "Designer"],
      "lastUpdated": "2024-01-15T10:30:00.000Z"
    },
    {
      "country": "CA",
      "totalApplicants": 75,
      "roles": ["Developer"],
      "lastUpdated": "2024-01-15T09:15:00.000Z"
    }
  ],
  "period": {
    "filter": "monthly",
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-01-31T23:59:59.999Z"
  },
  "totalCountries": 2,
  "totalApplicants": 225
}
```

### 2. Get Comparison Data

**GET** `/comparison`

Return percentage change compared to the previous time period.

#### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `filter` | string | No | Time period filter (`weekly`, `monthly`, `yearly`) | `monthly` |
| `roles` | string | No | JSON array of roles to filter by | `["Developer"]` |

#### Example Request

```bash
GET /api/application-analytics/comparison?filter=monthly&roles=["Developer"]
```

#### Example Response

```json
{
  "data": [
    {
      "country": "US",
      "currentApplicants": 150,
      "previousApplicants": 120,
      "change": 30,
      "percentageChange": 25.0,
      "trend": "up"
    },
    {
      "country": "CA",
      "currentApplicants": 75,
      "previousApplicants": 80,
      "change": -5,
      "percentageChange": -6.25,
      "trend": "down"
    }
  ],
  "periods": {
    "current": {
      "filter": "monthly",
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-31T23:59:59.999Z"
    },
    "previous": {
      "filter": "monthly",
      "startDate": "2023-12-01T00:00:00.000Z",
      "endDate": "2023-12-31T23:59:59.999Z"
    }
  },
  "summary": {
    "totalCountries": 2,
    "countriesWithGrowth": 1,
    "countriesWithDecline": 1,
    "countriesStable": 0,
    "averageChange": 9.375
  }
}
```

### 3. Create Application Data

**POST** `/applications`

Create or update application analytics data.

#### Request Body

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `country` | string | Yes | 2-letter ISO country code | `"US"` |
| `numberOfApplicants` | number | Yes | Number of applicants (non-negative) | `25` |
| `role` | string | Yes | Role/position type | `"Developer"` |
| `timestamp` | string | No | ISO date string (defaults to current time) | `"2024-01-15T10:30:00.000Z"` |

#### Example Request

```bash
POST /api/application-analytics/applications
Content-Type: application/json

{
  "country": "US",
  "numberOfApplicants": 25,
  "role": "Developer",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Example Response

```json
{
  "message": "Application analytics data created successfully",
  "data": {
    "_id": "65a1b2c3d4e5f6789012345",
    "country": "US",
    "numberOfApplicants": 25,
    "role": "Developer",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "createdDatetime": "2024-01-15T10:30:00.000Z",
    "modifiedDatetime": "2024-01-15T10:30:00.000Z"
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid filter. Must be weekly, monthly, or yearly"
}
```

### 403 Forbidden
```json
{
  "error": "You are not authorized to view application analytics"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to fetch application data",
  "details": "Database connection error"
}
```

## Caching

The API implements intelligent caching with Redis (with fallback to in-memory cache):

- **Weekly data**: Cached for 5 minutes
- **Monthly data**: Cached for 30 minutes  
- **Yearly data**: Cached for 30 minutes
- **Comparison data**: Cached for 10 minutes

Cache is automatically invalidated when new data is created.

## Data Model

The application analytics data is stored with the following schema:

```javascript
{
  country: String,           // ISO country code (e.g., "US", "CA")
  numberOfApplicants: Number, // Number of applicants
  role: String,              // Role/position type
  timestamp: Date,           // When the data was recorded
  createdDatetime: Date,     // When the record was created
  modifiedDatetime: Date      // When the record was last modified
}
```

### 4. Get Available Roles

**GET** `/roles`

Get all available roles for multi-select filtering in the frontend.

#### Example Request

```bash
GET /api/application-analytics/roles
```

#### Example Response

```json
{
  "roles": [
    "Administrator",
    "Developer", 
    "Designer",
    "Project Manager",
    "Business Analyst"
  ],
  "count": 5
}
```

## Enhanced Features for Map Visualization

### Custom Date Range Support

When using `startDate` and `endDate` parameters, the response includes:

```json
{
  "data": [...],
  "period": {
    "filter": "custom",
    "startDate": "2024-03-01T00:00:00.000Z",
    "endDate": "2024-05-31T23:59:59.999Z", 
    "type": "custom",
    "supportsComparison": false
  },
  "summary": {
    "totalCountries": 15,
    "totalApplicants": 1250,
    "hasData": true,
    "periodLabel": "2024-03-01 to 2024-05-31"
  }
}
```

> **Important**: Custom date ranges automatically disable hover comparison (frontend requirement) to ensure accuracy.

## Usage Examples

### Frontend Integration

```javascript
// Fetch monthly application data
const response = await fetch('/api/application-analytics/applications?filter=monthly', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-token'
  },
  body: JSON.stringify({
    requestor: {
      requestorId: 'user-id',
      role: 'Administrator'
    }
  })
});

const data = await response.json();
console.log('Total applicants:', data.totalApplicants);
```

### Create Application Data

```javascript
// Create new application data
const response = await fetch('/api/application-analytics/applications', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-token'
  },
  body: JSON.stringify({
    requestor: {
      requestorId: 'user-id',
      role: 'Administrator'
    },
    country: 'US',
    numberOfApplicants: 25,
    role: 'Developer'
  })
});

const result = await response.json();
console.log('Created:', result.message);
```
