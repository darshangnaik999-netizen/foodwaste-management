
from flask import Flask, request, jsonify, send_from_directory
from sklearn.ensemble import RandomForestRegressor
import numpy as np

app = Flask(__name__, static_folder=".", static_url_path="")

# ==========================================
# 1. CREATE SYNTHETIC DEMO TRAINING DATA
# ==========================================

def create_demo_dataset():
    rng = np.random.default_rng(42)

    number_of_samples = 2000

    attendance = rng.integers(50, 1200, number_of_samples)
    previous_consumption = rng.integers(30, 1200, number_of_samples)
    demand_change = rng.uniform(-20, 30, number_of_samples)

    # Meal type: breakfast=0, lunch=1, dinner=2
    meal_type = rng.integers(0, 3, number_of_samples)

    meal_factors = np.array([0.92, 1.00, 0.96])
    attendance_rate = rng.uniform(0.85, 0.98, number_of_samples)

    attendance_estimate = (
        attendance * attendance_rate * meal_factors[meal_type]
    )

    base_demand = (
        attendance_estimate * 0.60
        + previous_consumption * 0.40
    )

    demand = (
        base_demand * (1 + demand_change / 100)
        + rng.normal(0, 12, number_of_samples)
    )

    demand = np.clip(demand, 0, attendance * 1.2)

    X = np.column_stack([
        attendance,
        previous_consumption,
        demand_change,
        meal_type
    ])

    y = demand

    return X, y


# ==========================================
# 2. TRAIN RANDOM FOREST MODEL
# ==========================================

X, y = create_demo_dataset()

model = RandomForestRegressor(
    n_estimators=150,
    max_depth=12,
    random_state=42
)

model.fit(X, y)

print("SustainFood AI model trained successfully!")
print("Training data: Synthetic demonstration data")


# ==========================================
# 3. WEBSITE HOME PAGE
# ==========================================

@app.route("/")
def home():
    return send_from_directory(".", "index.html")


# ==========================================
# 4. AI PREDICTION API
# ==========================================

@app.route("/api/predict", methods=["POST"])
def predict_food():

    try:
        data = request.get_json()

        attendance = int(data["attendance"])
        previous = float(data["previous_consumption"])
        adjustment = float(data["demand_change"])
        meal = data["meal_type"].lower()

        if attendance < 1 or previous < 0:
            return jsonify({
                "error": "Please enter valid attendance and consumption."
            }), 400

        if attendance > 100000 or previous > 100000:
            return jsonify({
                "error": "Please enter realistic values."
            }), 400

        if not -50 <= adjustment <= 100:
            return jsonify({
                "error": "Demand adjustment must be between -50 and 100."
            }), 400

        meal_mapping = {
            "breakfast": 0,
            "lunch": 1,
            "dinner": 2
        }

        if meal not in meal_mapping:
            return jsonify({
                "error": "Invalid meal type."
            }), 400

        meal_code = meal_mapping[meal]

        input_data = np.array([[
            attendance,
            previous,
            adjustment,
            meal_code
        ]])

        prediction = model.predict(input_data)[0]

        recommended_meals = max(
            0,
            min(int(round(prediction)), int(attendance * 1.2))
        )

        return jsonify({
            "success": True,
            "recommended_meals": recommended_meals,
            "meal_type": meal.title(),
            "message": "Prediction generated successfully.",
            "model": "Random Forest Regression",
            "data_source": "Synthetic demonstration data"
        })

    except (KeyError, ValueError, TypeError):
        return jsonify({
            "error": "Please provide valid prediction details."
        }), 400

    except Exception as error:
        print("Prediction error:", error)

        return jsonify({
            "error": "Unable to generate prediction."
        }), 500


# ==========================================
# 5. START FLASK SERVER
# ==========================================

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
