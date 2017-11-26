package net.mariobodemann.scurvypirateskirmish;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.support.v7.app.AppCompatActivity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;

import com.firebase.ui.auth.AuthUI;
import com.firebase.ui.auth.IdpResponse;
import com.firebase.ui.auth.ResultCodes;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;

import java.util.Collections;
import java.util.List;
import java.util.Random;

public class MainActivity extends AppCompatActivity {

  private int zoom = 5;
  private FirebaseUser user;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_main);

    findViewById(R.id.zoom_in).setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) {
        zoom--;
        zoom = Math.max(1, zoom);

        drawBoard();
      }
    });

    findViewById(R.id.zoom_out).setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) {
        zoom++;
        drawBoard();
      }
    });

  }

  @Override protected void onResume() {
    super.onResume();

    List<AuthUI.IdpConfig> providers = Collections.singletonList(
        new AuthUI.IdpConfig.Builder(AuthUI.GOOGLE_PROVIDER).build());

    if (user == null) {
      startActivityForResult(
          AuthUI.getInstance()
              .createSignInIntentBuilder()
              .setAvailableProviders(providers)
              .build(),
          1);
    }
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);

    if (requestCode == 1) {
      final IdpResponse response = IdpResponse.fromResultIntent(data);

      if (resultCode == ResultCodes.OK) {
        user = FirebaseAuth.getInstance().getCurrentUser();

        final FirebaseDatabase db = FirebaseDatabase.getInstance();
        final DatabaseReference ref = db.getReference("ships");
        ref.addValueEventListener(new ValueEventListener() {
          @Override public void onDataChange(DataSnapshot dataSnapshot) {
            drawBoard();
          }

          @Override public void onCancelled(DatabaseError databaseError) {

          }
        });
      }
    }
  }

  private void drawBoard() {

    final ViewGroup board = findViewById(R.id.board);
    board.removeAllViews();
    final ViewGroup ships = findViewById(R.id.ships);

    final int width = board.getWidth();

    final int cellSize = width / zoom;


    final FirebaseDatabase db = FirebaseDatabase.getInstance();
    final DatabaseReference ref = db.getReference("ships");
    ref.addValueEventListener(new ValueEventListener() {
      @Override public void onDataChange(DataSnapshot dataSnapshot) {
        ships.removeAllViews();

        for (int y = 0; y < zoom; ++y) {
          for (int x = 0; x < zoom; ++x) {
            final ImageView cell = new ImageView(MainActivity.this);
            final int id = xyToRes(x, y, dataSnapshot);
            if (id == 0) {
              continue;
            }

            Bitmap bitmap = BitmapFactory.decodeResource(getResources(), id);
            cell.setImageBitmap(bitmap);

            LinearLayout.LayoutParams parms = new LinearLayout.LayoutParams(cellSize, cellSize);
            cell.setLayoutParams(parms);

            cell.setX(x * cellSize);
            cell.setY(y * cellSize);
            ships.addView(cell, 0);
          }
        }
      }

      private int xyToRes(int x, int y, DataSnapshot dataSnapshot) {
        final Object value = dataSnapshot.getValue();
        switch (new Random().nextInt(10)) {
          case 0:
            return R.drawable.ship_0_0;
          case 1:
            return R.drawable.ship_1_0;
          case 2:
            return R.drawable.ship_2_0;
          default:
            return 0;
        }
      }

      @Override public void onCancelled(DatabaseError databaseError) {

      }
    });

    for (int y = 0; y < zoom; ++y) {
      for (int x = 0; x < zoom; ++x) {
        final ImageView cell = new ImageView(this);
        Bitmap bitmap = BitmapFactory.decodeResource(getResources(), R.drawable.water);
        cell.setImageBitmap(bitmap);

        LinearLayout.LayoutParams parms = new LinearLayout.LayoutParams(cellSize, cellSize);
        cell.setLayoutParams(parms);

        cell.setX(x * cellSize);
        cell.setY(y * cellSize);
        board.addView(cell, 0);
      }
    }
  }
}
