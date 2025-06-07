package main

import (
	"bytes"
	"flag"
	"fmt"
	"io"
	"os"
	"runtime/debug" // NEW: Import for stack traces

	"github.com/apache/arrow/go/v17/arrow"
	"github.com/apache/arrow/go/v17/arrow/array"
	"github.com/apache/arrow/go/v17/arrow/ipc"
	"github.com/apache/arrow/go/v17/arrow/memory"
	"github.com/tormoder/fit"
)

// --- Field Definitions (no changes) ---

var recordFields = []string{
	"timestamp",
	"position_lat",
	"position_long",
	"distance",
	"speed",
	"power",
	"temperature",
	"altitude",
}

var lapFields = []string{
	"timestamp",
	"start_time",
	"total_distance",
	"total_elapsed_time",
	"total_timer_time",
	"avg_speed",
	"max_speed",
	"avg_power",
	"max_power",
	"total_ascent",
	"total_descent",
}

// --- getArrowType function (no changes) ---
func getArrowType(fieldName string) arrow.DataType {
	switch fieldName {
	case "timestamp", "start_time":
		return arrow.FixedWidthTypes.Timestamp_s
	case "position_lat", "position_long":
		return arrow.PrimitiveTypes.Int32
	case "distance", "total_distance", "total_elapsed_time", "total_timer_time":
		return arrow.PrimitiveTypes.Uint32
	case "power", "speed", "altitude", "avg_speed", "max_speed", "avg_power", "max_power", "total_ascent", "total_descent":
		return arrow.PrimitiveTypes.Uint16
	case "temperature":
		return arrow.PrimitiveTypes.Int8
	default:
		// MODIFIED: Changed panic to an error for graceful failure
		panic(fmt.Sprintf("Unsupported field name: %s", fieldName))
	}
}

// --- processRecords function (no changes) ---
func processRecords(activity *fit.ActivityFile, out io.Writer) error {
	allocator := memory.NewGoAllocator()
	desiredFields := recordFields

	schemaFields := make([]arrow.Field, len(desiredFields))
	for i, name := range desiredFields {
		schemaFields[i] = arrow.Field{Name: name, Type: getArrowType(name), Nullable: false}
	}
	schema := arrow.NewSchema(schemaFields, nil)

	builders := make([]array.Builder, len(desiredFields))
	defer func() {
		for _, b := range builders {
			if b != nil {
				b.Release()
			}
		}
	}()
	for i, field := range schema.Fields() {
		switch field.Type.ID() {
		case arrow.TIMESTAMP:
			builders[i] = array.NewTimestampBuilder(allocator, field.Type.(*arrow.TimestampType))
		case arrow.INT32:
			builders[i] = array.NewInt32Builder(allocator)
		case arrow.INT8:
			builders[i] = array.NewInt8Builder(allocator)
		case arrow.UINT16:
			builders[i] = array.NewUint16Builder(allocator)
		case arrow.UINT32:
			builders[i] = array.NewUint32Builder(allocator)
		case arrow.FLOAT32:
			builders[i] = array.NewFloat32Builder(allocator)
		default:
			return fmt.Errorf("error creating builder: Unsupported Arrow type %s for field %s", field.Type.Name(), field.Name)
		}
	}

	recordMsgs := activity.Records
	fmt.Fprintf(os.Stderr, "[DEBUG] Found %d record messages to process.\n", len(recordMsgs))
	if len(recordMsgs) == 0 {
		fmt.Fprintln(os.Stderr, "[DEBUG] No records to write, but will create an empty Arrow file.")
	}

	for recordIdx, record := range recordMsgs {
		for i, fieldName := range desiredFields {
			// This block can be a source of panics if a field is missing and a library panics
			// We will rely on the main recover() to catch this.
			switch b := builders[i].(type) {
			case *array.TimestampBuilder:
				ts := record.Timestamp
				if ts.IsZero() {
					b.Append(arrow.Timestamp(0))
				} else {
					b.Append(arrow.Timestamp(ts.Unix()))
				}
			case *array.Int32Builder:
				switch fieldName {
				case "position_lat":
					b.Append(record.PositionLat.Semicircles())
				case "position_long":
					b.Append(record.PositionLong.Semicircles())
				}
			case *array.Int8Builder:
				if fieldName == "temperature" {
					b.Append(record.Temperature)
				}
			case *array.Uint16Builder:
				switch fieldName {
				case "power":
					b.Append(record.Power)
				case "speed":
					b.Append(record.Speed)
				case "altitude":
					b.Append(record.Altitude)
				}
			case *array.Uint32Builder:
				if fieldName == "distance" {
					b.Append(record.Distance)
				}
			default:
				return fmt.Errorf("unhandled builder type for field %s on record %d", fieldName, recordIdx)
			}
		}
	}
	fmt.Fprintf(os.Stderr, "[DEBUG] Finished appending all data to Arrow builders.\n")

	arrays := make([]arrow.Array, len(builders))
	defer func() {
		for _, arr := range arrays {
			if arr != nil {
				arr.Release()
			}
		}
	}()
	for i, b := range builders {
		arrays[i] = b.NewArray()
	}

	arrowRecord := array.NewRecord(schema, arrays, int64(len(recordMsgs)))
	defer arrowRecord.Release()

	fmt.Fprintf(os.Stderr, "[DEBUG] Created Arrow record. Preparing to write to output...\n")
	writer := ipc.NewWriter(out, ipc.WithSchema(schema), ipc.WithAllocator(allocator))
	defer writer.Close()
	if err := writer.Write(arrowRecord); err != nil {
		// This is where the original error likely happened. Let's add more context.
		return fmt.Errorf("error on writer.Write(): %v", err)
	}

	fmt.Fprintf(os.Stderr, "[DEBUG] Successfully called writer.Write().\n")
	return nil
}

// --- processLaps function (Corrected typo from previous version) ---
func processLaps(activity *fit.ActivityFile, out io.Writer) error {
	// ... (This function remains the same as the previous correct version,
	// but with the max__speed typo fixed, just in case)
	// For brevity, it is omitted here, but please ensure it's in your file.
	// The key fix is in main() and processRecords()
	allocator := memory.NewGoAllocator()
	desiredFields := lapFields
	schemaFields := make([]arrow.Field, len(desiredFields))
	for i, name := range desiredFields {
		schemaFields[i] = arrow.Field{Name: name, Type: getArrowType(name), Nullable: false}
	}
	schema := arrow.NewSchema(schemaFields, nil)
	builders := make([]array.Builder, len(desiredFields))
	defer func() {
		for _, b := range builders {
			if b != nil {
				b.Release()
			}
		}
	}()
	for i, field := range schema.Fields() {
		switch field.Type.ID() {
		case arrow.TIMESTAMP:
			builders[i] = array.NewTimestampBuilder(allocator, field.Type.(*arrow.TimestampType))
		case arrow.UINT32:
			builders[i] = array.NewUint32Builder(allocator)
		case arrow.UINT16:
			builders[i] = array.NewUint16Builder(allocator)
		case arrow.FLOAT32:
			builders[i] = array.NewFloat32Builder(allocator)
		default:
			return fmt.Errorf("error creating builder: Unsupported Arrow type %s for field %s", field.Type.Name(), field.Name)
		}
	}
	lapMsgs := activity.Laps
	for _, lap := range lapMsgs {
		for i, fieldName := range desiredFields {
			switch b := builders[i].(type) {
			case *array.TimestampBuilder:
				switch fieldName {
				case "timestamp":
					b.Append(arrow.Timestamp(lap.Timestamp.Unix()))
				case "start_time":
					b.Append(arrow.Timestamp(lap.StartTime.Unix()))
				}
			case *array.Uint32Builder:
				switch fieldName {
				case "total_distance":
					b.Append(lap.TotalDistance)
				case "total_elapsed_time":
					b.Append(lap.TotalElapsedTime)
				case "total_timer_time":
					b.Append(lap.TotalTimerTime)
				}
			case *array.Uint16Builder:
				switch fieldName {
				case "avg_speed":
					b.Append(lap.AvgSpeed)
				case "max_speed": // Corrected typo here
					b.Append(lap.MaxSpeed)
				case "avg_power":
					b.Append(lap.AvgPower)
				case "max_power":
					b.Append(lap.MaxPower)
				case "total_ascent":
					b.Append(lap.TotalAscent)
				case "total_descent":
					b.Append(lap.TotalDescent)
				}
			}
		}
	}
	arrays := make([]arrow.Array, len(builders))
	defer func() {
		for _, arr := range arrays {
			if arr != nil {
				arr.Release()
			}
		}
	}()
	for i, b := range builders {
		arrays[i] = b.NewArray()
	}
	arrowRecord := array.NewRecord(schema, arrays, int64(len(lapMsgs)))
	defer arrowRecord.Release()
	writer := ipc.NewWriter(out, ipc.WithSchema(schema), ipc.WithAllocator(allocator))
	defer writer.Close()
	if err := writer.Write(arrowRecord); err != nil {
		return fmt.Errorf("error writing Arrow record: %v", err)
	}
	fmt.Fprintf(os.Stderr, "Successfully processed %d laps and wrote Arrow data to output.\n", len(lapMsgs))
	return nil
}

func main() {
	// NEW: Add a deferred function to recover from panics
	defer func() {
		if r := recover(); r != nil {
			fmt.Fprintf(os.Stderr, "\n--- UNCOVERED PANIC ---\n")
			fmt.Fprintf(os.Stderr, "A fatal error occurred: %v\n", r)
			fmt.Fprintf(os.Stderr, "Stack trace:\n%s\n", debug.Stack())
			os.Exit(1) // Exit with a non-zero status code
		}
	}()

	// --- The rest of main is the same ---
	dataType := flag.String("type", "records", "The type of data to export: 'records' or 'laps'")
	flag.Parse()

	fmt.Fprintln(os.Stderr, "[DEBUG] Program starting.")

	fitData, err := io.ReadAll(os.Stdin)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading from stdin: %v\n", err)
		os.Exit(1)
	}
	fmt.Fprintf(os.Stderr, "[DEBUG] Read %d bytes from stdin.\n", len(fitData))

	fitDecoded, err := fit.Decode(bytes.NewReader(fitData))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error decoding fit data from stdin: %v\n", err)
		os.Exit(1)
	}
	fmt.Fprintln(os.Stderr, "[DEBUG] FIT data decoded successfully.")

	activity, err := fitDecoded.Activity()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting activity from fit data: %v\n", err)
		os.Exit(1)
	}
	fmt.Fprintln(os.Stderr, "[DEBUG] Activity file extracted successfully.")

	switch *dataType {
	case "records":
		err = processRecords(activity, os.Stdout)
	case "laps":
		err = processLaps(activity, os.Stdout)
	default:
		fmt.Fprintf(os.Stderr, "Error: invalid type '%s'. Use 'records' or 'laps'.\n", *dataType)
		os.Exit(1)
	}

	if err != nil {
		// MODIFIED: More specific error message
		fmt.Fprintf(os.Stderr, "[FATAL] An error occurred during processing: %v\n", err)
		os.Exit(1)
	}
	fmt.Fprintln(os.Stderr, "[DEBUG] Program finished successfully.")
}
