
import sys
import pyarrow as pa
import pyarrow.ipc as pa_ipc
import pandas as pd
from absl import flags


FLAGS = flags.FLAGS

flags.DEFINE_string('arrow_file', None, 'Path to the Arrow file to visualize.')

flags.mark_flag_as_required('arrow_file')

def main():
    """Main function to read and visualize the Arrow file."""
    print(FLAGS.arrow_file)
    try:
        with pa.memory_map(FLAGS.arrow_file, 'r') as source:
            # Use open_stream as the Go program writes in stream format
            table = pa_ipc.open_stream(source).read_all()
            df = table.to_pandas()
            print(df.head())  # Print the first 5 rows
            # Or to view in a more interactive way (e.g., in Jupyter notebooks):
            # display(df)
    except FileNotFoundError:
        print(f"Error: '{FLAGS.arrow_file}' not found. Please provide the correct file path.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    flags.FLAGS(sys.argv)
    main()
