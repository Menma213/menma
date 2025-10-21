import json

def extract_user_data(input_filename, output_filename):
    """
    Reads a large JSON file and extracts a subset of key-value pairs
    for each user, saving the result to a new JSON file.
    """
    try:
        # Open and read the input JSON file
        with open(input_filename, 'r', encoding='utf-8') as f_in:
            data = json.load(f_in)
        
        # Initialize the dictionary to hold the new, processed data
        processed_data = {}
        
        # Iterate through each user ID in the loaded data
        for user_id, user_info in data.items():
            # Create a dictionary for the specific user's data
            new_user_data = {}
            
            # Extract the required fields, handling potential missing keys
            # The 'get' method returns None if the key doesn't exist, preventing errors
            new_user_data["level"] = user_info.get("level")
            new_user_data["exp"] = user_info.get("exp")
            new_user_data["money"] = user_info.get("money")
            new_user_data["ramen"] = user_info.get("ramen")
            new_user_data["ss"] = user_info.get("ss") # Assumes 'SS' is a top-level key; will be None if not found
            new_user_data["elo"] = user_info.get("elo")

            # Add the processed user data to the main dictionary
            processed_data[user_id] = new_user_data

        # Open and write the new JSON file with formatted output
        with open(output_filename, 'w', encoding='utf-8') as f_out:
            json.dump(processed_data, f_out, indent=4)
        
        print(f"Successfully extracted data from '{input_filename}' and saved to '{output_filename}'.")
        
    except FileNotFoundError:
        print(f"Error: The file '{input_filename}' was not found.")
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{input_filename}'. Please check the file's format.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

# --- Main execution block ---
if __name__ == "__main__":
    # The script now looks for the JSON file in the specified directory
    input_file_name = "oldusers.json"
    output_file_name = "output.json"
    
    extract_user_data(input_file_name, output_file_name)
